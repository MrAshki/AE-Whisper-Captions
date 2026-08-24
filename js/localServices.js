(function (global) {
    "use strict";

    function nodeRequire(name) {
        if (typeof require === "function") {
            return require(name);
        }
        if (global.cep_node && typeof global.cep_node.require === "function") {
            return global.cep_node.require(name);
        }
        throw new Error("The CEP Node environment is not enabled");
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
                reject(new Error("Missing executable path"));
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
                    reject(new Error((stderr || stdout || "Process failed").trim() + " (code " + code + ")"));
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

    function fileExists(filePath) {
        var fs = nodeRequire("fs");
        return fs.existsSync(filePath);
    }

    function writeText(filePath, text) {
        var fs = nodeRequire("fs");
        fs.writeFileSync(filePath, text, "utf8");
    }

    function parseClockSeconds(value) {
        var match = String(value || "").trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
        if (!match) {
            return NaN;
        }
        var ms = match[4];
        while (ms.length < 3) {
            ms += "0";
        }
        return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(ms.slice(0, 3)) / 1000;
    }

    function normalizedWordFromSegment(segment, previousWord) {
        var text = String(segment && segment.text ? segment.text : "").trim();
        if (!text) {
            return null;
        }

        var start = NaN;
        var end = NaN;
        if (segment.offsets) {
            start = Number(segment.offsets.from) / 1000;
            end = Number(segment.offsets.to) / 1000;
        }
        if (!isFinite(start) || !isFinite(end)) {
            start = parseClockSeconds(segment.timestamps && segment.timestamps.from);
            end = parseClockSeconds(segment.timestamps && segment.timestamps.to);
        }

        if (!isFinite(start) || start < 0) {
            return null;
        }
        if (!isFinite(end) || end <= start) {
            end = start + 0.04;
        }
        if (previousWord && start < previousWord.end) {
            start = previousWord.end;
            if (end <= start) {
                end = start + 0.04;
            }
        }

        return {
            text: text,
            start: Math.round(start * 1000) / 1000,
            end: Math.round(end * 1000) / 1000
        };
    }

    function parseWhisperJsonWords(filePath) {
        var payload = readJson(filePath);
        var segments = payload && payload.transcription;
        var words = [];
        if (!Array.isArray(segments)) {
            return words;
        }
        segments.forEach(function (segment) {
            var word = normalizedWordFromSegment(segment, words[words.length - 1]);
            if (word) {
                words.push(word);
            }
        });
        return words;
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
                throw new Error(payload.error || "Local transcription failed");
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
            return Promise.reject(new Error("whisper.cpp requires program and model paths"));
        }
        var outputBase = tempFile("").replace(/\.$/, "");
        return convertToWav(inputPath, settings, onLog).then(function (wavPath) {
            var args = [
                "-m", settings.whisperModel,
                "-f", wavPath,
                "-oj",
                "-ojf",
                "-sow",
                "-ml", "1",
                "-osrt",
                "-of", outputBase
            ];
            if (settings.language && settings.language !== "auto") {
                args.push("-l", settings.language);
            }
            return spawnProcess(settings.whisperCli, args, onLog);
        }).then(function () {
            var jsonPath = outputBase + ".json";
            if (fileExists(jsonPath)) {
                try {
                    var sourceWords = parseWhisperJsonWords(jsonPath);
                    if (sourceWords.length) {
                        return { sourceWords: sourceWords };
                    }
                    if (onLog) {
                        onLog("Word-level JSON did not contain valid words. Falling back to SRT segments.");
                    }
                } catch (jsonError) {
                    if (onLog) {
                        onLog("Could not parse word-level JSON. Falling back to SRT segments: " + jsonError.message);
                    }
                }
            } else if (onLog) {
                onLog("Word-level JSON was not created. Falling back to SRT segments.");
            }
            return global.SRT.parse(readText(outputBase + ".srt"), { detectBilingual: false });
        });
    }

    function transcribe(inputPath, settings, onLog) {
        settings = settings || {};
        if (!inputPath) {
            return Promise.reject(new Error("Select an audio or video file first"));
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
                throw new Error(payload.error || "Vocal separation failed");
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
                throw new Error(payload.error || "Offline translation failed");
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
