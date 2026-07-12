(function (global) {
    "use strict";

    function nodeRequire(name) {
        if (typeof require === "function") {
            return require(name);
        }
        if (global.cep_node && typeof global.cep_node.require === "function") {
            return global.cep_node.require(name);
        }
        throw new Error("未启用 CEP Node 环境");
    }

    function extensionDir() {
        if (global.__adobe_cep__ && typeof global.__adobe_cep__.getSystemPath === "function") {
            return normalizePath(global.__adobe_cep__.getSystemPath("extension"));
        }
        var path = decodeURI(global.location.pathname);
        if (/^\/[A-Za-z]:\//.test(path)) {
            path = path.slice(1);
        }
        return path.replace(/\/[^\/]*$/, "");
    }

    function normalizePath(value) {
        value = String(value || "");
        if (/^file:\/\//i.test(value)) {
            value = value.replace(/^file:\/\//i, "");
        }
        value = decodeURI(value);
        if (/^\/[A-Za-z]:\//.test(value)) {
            value = value.slice(1);
        }
        return value.replace(/\//g, "\\");
    }

    function ensureTempDir() {
        var fs = nodeRequire("fs");
        var path = nodeRequire("path");
        var os = nodeRequire("os");
        var dir = path.join(os.tmpdir(), "AESpeechSubtitleAI");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    function tempFile(extension) {
        var path = nodeRequire("path");
        var suffix = extension.charAt(0) === "." ? extension : "." + extension;
        return path.join(ensureTempDir(), Date.now() + "-" + Math.random().toString(16).slice(2) + suffix);
    }

    function spawnProcess(command, args, onLog, options) {
        options = options || {};
        var childProcess = nodeRequire("child_process");
        return new Promise(function (resolve, reject) {
            if (!command) {
                reject(new Error("缺少可执行程序路径"));
                return;
            }

            var child = childProcess.spawn(command, args || [], {
                cwd: options.cwd || extensionDir(),
                windowsHide: true,
                shell: false
            });
            var stdout = "";
            var stderr = "";

            child.stdout.on("data", function (chunk) {
                var text = chunk.toString();
                stdout += text;
                if (onLog) {
                    onLog(text.trim());
                }
            });

            child.stderr.on("data", function (chunk) {
                var text = chunk.toString();
                stderr += text;
                if (onLog) {
                    onLog(text.trim());
                }
            });

            child.on("error", function (error) {
                reject(error);
            });

            child.on("close", function (code) {
                if (code === 0) {
                    resolve({ stdout: stdout, stderr: stderr });
                } else {
                    reject(new Error((stderr || stdout || "进程失败").trim() + " (code " + code + ")"));
                }
            });
        });
    }

    function readJson(filePath) {
        var fs = nodeRequire("fs");
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    function writeJson(filePath, payload) {
        var fs = nodeRequire("fs");
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    }

    function readText(filePath) {
        var fs = nodeRequire("fs");
        return fs.readFileSync(filePath, "utf8");
    }

    function writeText(filePath, text) {
        var fs = nodeRequire("fs");
        fs.writeFileSync(filePath, text, "utf8");
    }

    function transcribeFasterWhisper(inputPath, settings, onLog) {
        var path = nodeRequire("path");
        var script = path.join(extensionDir(), "backend", "transcribe_faster_whisper.py");
        var output = tempFile(".json");
        var python = settings.pythonPath || "python";
        var args = [
            script,
            "--input", inputPath,
            "--output", output,
            "--model", settings.model || "large-v3-turbo",
            "--device", settings.device || "auto",
            "--compute-type", settings.computeType || "auto"
        ];

        if (settings.language && settings.language !== "auto") {
            args.push("--language", settings.language);
        }

        return spawnProcess(python, args, onLog).then(function () {
            var payload = readJson(output);
            if (!payload.ok) {
                throw new Error(payload.error || "本地转录失败");
            }
            return payload.captions || [];
        });
    }

    function convertToWav(inputPath, settings, onLog) {
        var path = nodeRequire("path");
        var ext = path.extname(inputPath).toLowerCase();
        if (ext === ".wav") {
            return Promise.resolve(inputPath);
        }
        var output = tempFile(".wav");
        var ffmpeg = settings.ffmpegPath || "ffmpeg";
        return spawnProcess(ffmpeg, [
            "-y",
            "-i", inputPath,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            output
        ], onLog).then(function () {
            return output;
        });
    }

    function transcribeWhisperCpp(inputPath, settings, onLog) {
        if (!settings.whisperCli || !settings.whisperModel) {
            return Promise.reject(new Error("whisper.cpp 需要填写程序路径和模型路径"));
        }
        var outputBase = tempFile("").replace(/\.$/, "");
        return convertToWav(inputPath, settings, onLog).then(function (wavPath) {
            var args = [
                "-m", settings.whisperModel,
                "-f", wavPath,
                "-osrt",
                "-of", outputBase
            ];
            if (settings.language && settings.language !== "auto") {
                args.push("-l", settings.language);
            }
            return spawnProcess(settings.whisperCli, args, onLog);
        }).then(function () {
            return global.SRT.parse(readText(outputBase + ".srt"), { detectBilingual: false });
        });
    }

    function transcribe(inputPath, settings, onLog) {
        settings = settings || {};
        if (!inputPath) {
            return Promise.reject(new Error("请先选择音频或视频文件"));
        }
        if (settings.backend === "whisper.cpp") {
            return transcribeWhisperCpp(inputPath, settings, onLog);
        }
        return transcribeFasterWhisper(inputPath, settings, onLog);
    }

    function separateVocals(inputPath, settings, onLog) {
        var path = nodeRequire("path");
        var script = path.join(extensionDir(), "backend", "separate_demucs.py");
        var output = tempFile(".json");
        var python = settings.pythonPath || "python";
        var outDir = path.join(ensureTempDir(), "demucs-" + Date.now());
        var args = [
            script,
            "--input", inputPath,
            "--output", output,
            "--outdir", outDir,
            "--model", settings.demucsModel || "htdemucs"
        ];

        return spawnProcess(python, args, onLog).then(function () {
            var payload = readJson(output);
            if (!payload.ok) {
                throw new Error(payload.error || "人声分离失败");
            }
            return payload.vocals;
        });
    }

    function translateOffline(texts, settings, onLog) {
        var path = nodeRequire("path");
        var input = tempFile(".json");
        var output = tempFile(".json");
        var script = path.join(extensionDir(), "backend", "translate_argos.py");
        var python = settings.pythonPath || "python";
        writeJson(input, {
            texts: texts || [],
            source: settings.sourceLang || "auto",
            target: settings.targetLang || "zh"
        });
        return spawnProcess(python, [
            script,
            "--input", input,
            "--output", output
        ], onLog).then(function () {
            var payload = readJson(output);
            if (!payload.ok) {
                throw new Error(payload.error || "离线翻译失败");
            }
            return payload.translations || [];
        });
    }

    function defaultExportPath(baseName, extension) {
        var path = nodeRequire("path");
        var os = nodeRequire("os");
        var safeBase = String(baseName || "subtitles").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
        var dir = path.join(os.homedir(), "Documents", "AESpeechSubtitleAI");
        var fs = nodeRequire("fs");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, safeBase + extension);
    }

    function basenameWithoutExt(filePath) {
        var path = nodeRequire("path");
        if (!filePath) {
            return "subtitles";
        }
        return path.basename(filePath, path.extname(filePath));
    }

    global.LocalServices = {
        extensionDir: extensionDir,
        transcribe: transcribe,
        separateVocals: separateVocals,
        translateOffline: translateOffline,
        writeText: writeText,
        readText: readText,
        defaultExportPath: defaultExportPath,
        basenameWithoutExt: basenameWithoutExt,
        normalizePath: normalizePath
    };
})(window);
