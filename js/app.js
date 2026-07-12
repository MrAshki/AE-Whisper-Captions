(function (global) {
    "use strict";

    var state = {
        captions: [],
        mediaPath: "",
        selected: {}
    };

    var $ = function (id) {
        return document.getElementById(id);
    };

    var fields = [
        "pythonPathInput",
        "mediaPathInput",
        "modelInput",
        "deviceInput",
        "computeTypeInput",
        "languageInput",
        "localBackendInput",
        "whisperCliInput",
        "whisperModelInput",
        "ffmpegPathInput",
        "detectBilingualInput",
        "separateVocalsInput",
        "localTranslateInput",
        "sourceLangInput",
        "targetLangInput",
        "maxCharsInput",
        "layerModeInput",
        "displayModeInput",
        "fontInput",
        "fontSizeInput",
        "fillColorInput",
        "strokeColorInput",
        "strokeWidthInput",
        "positionXInput",
        "positionYInput",
        "shadowInput"
    ];

    function init() {
        restoreSettings();
        bindEvents();
        render();
        log("插件已就绪。");
    }

    function bindEvents() {
        $("mediaFileInput").addEventListener("change", function (event) {
            var file = event.target.files && event.target.files[0];
            state.mediaPath = file ? (file.path || file.name) : "";
            $("mediaPathInput").value = state.mediaPath;
            setStatus(state.mediaPath ? "已选择：" + state.mediaPath : "待命");
            persistSettings();
        });

        $("mediaPathInput").addEventListener("input", function (event) {
            state.mediaPath = event.target.value.trim();
            persistSettings();
        });

        $("transcribeBtn").addEventListener("click", runTranscription);
        $("importSrtBtn").addEventListener("click", function () {
            $("srtFileInput").click();
        });
        $("srtFileInput").addEventListener("change", importSrtFile);
        $("readAeBtn").addEventListener("click", readAeTextLayers);
        $("segmentBtn").addEventListener("click", runSegmentation);
        $("localOptimizeBtn").addEventListener("click", runLocalOptimize);
        $("replaceBtn").addEventListener("click", replaceAll);
        $("addRowBtn").addEventListener("click", addRow);
        $("deleteRowsBtn").addEventListener("click", deleteRows);
        $("mergeRowsBtn").addEventListener("click", mergeRows);
        $("splitRowBtn").addEventListener("click", splitSelectedRow);
        $("importAeBtn").addEventListener("click", importToAe);
        $("exportSrtBtn").addEventListener("click", exportSrt);
        $("saveProjectBtn").addEventListener("click", saveProject);
        $("loadProjectBtn").addEventListener("click", function () {
            $("projectFileInput").click();
        });
        $("projectFileInput").addEventListener("change", loadProject);

        fields.forEach(function (id) {
            var el = $(id);
            if (el) {
                el.addEventListener("change", persistSettings);
                el.addEventListener("input", persistSettings);
            }
        });
    }

    function getSettings() {
        return {
            pythonPath: $("pythonPathInput").value.trim() || "python",
            model: $("modelInput").value.trim() || "large-v3-turbo",
            device: $("deviceInput").value,
            computeType: $("computeTypeInput").value,
            language: $("languageInput").value.trim() || "auto",
            backend: $("localBackendInput").value,
            whisperCli: $("whisperCliInput").value.trim(),
            whisperModel: $("whisperModelInput").value.trim(),
            ffmpegPath: $("ffmpegPathInput").value.trim() || "ffmpeg",
            detectBilingual: $("detectBilingualInput").checked,
            separateVocals: $("separateVocalsInput").checked,
            translate: $("localTranslateInput").checked,
            sourceLang: $("sourceLangInput").value.trim() || "auto",
            targetLang: $("targetLangInput").value.trim() || "zh",
            maxChars: Number($("maxCharsInput").value) || 24,
            layerMode: $("layerModeInput").value,
            displayMode: $("displayModeInput").value,
            font: $("fontInput").value.trim(),
            fontSize: Number($("fontSizeInput").value) || 64,
            fillColor: $("fillColorInput").value,
            strokeColor: $("strokeColorInput").value,
            strokeWidth: Number($("strokeWidthInput").value) || 0,
            positionX: Number($("positionXInput").value) || 50,
            positionY: Number($("positionYInput").value) || 86,
            shadow: $("shadowInput").checked
        };
    }

    function styleSettings(settings) {
        return {
            font: settings.font,
            fontSize: settings.fontSize,
            fillColor: settings.fillColor,
            strokeColor: settings.strokeColor,
            strokeWidth: settings.strokeWidth,
            positionX: settings.positionX,
            positionY: settings.positionY,
            shadow: settings.shadow
        };
    }

    function persistSettings() {
        var snapshot = { settings: {} };
        fields.forEach(function (id) {
            var el = $(id);
            if (el) {
                snapshot.settings[id] = el.type === "checkbox" ? el.checked : el.value;
            }
        });
        snapshot.mediaPath = state.mediaPath;
        localStorage.setItem("AESpeechSubtitleAI.settings", JSON.stringify(snapshot));
    }

    function restoreSettings() {
        var raw = localStorage.getItem("AESpeechSubtitleAI.settings");
        if (!raw) {
            return;
        }
        try {
            var snapshot = JSON.parse(raw);
            Object.keys(snapshot.settings || {}).forEach(function (id) {
                var el = $(id);
                if (!el) {
                    return;
                }
                if (el.type === "checkbox") {
                    el.checked = !!snapshot.settings[id];
                } else {
                    el.value = snapshot.settings[id];
                }
            });
            state.mediaPath = snapshot.mediaPath || "";
            if ($("mediaPathInput") && !snapshot.settings.mediaPathInput) {
                $("mediaPathInput").value = state.mediaPath;
            }
        } catch (error) {
            log("设置读取失败：" + error.message);
        }
    }

    function render() {
        var body = $("captionBody");
        body.innerHTML = "";
        state.captions.forEach(function (caption, index) {
            var row = document.createElement("tr");
            if (state.selected[caption.id]) {
                row.className = "selected";
            }
            row.innerHTML = [
                "<td><input data-role=\"select\" type=\"checkbox\"" + (state.selected[caption.id] ? " checked" : "") + "></td>",
                "<td class=\"row-index\">" + (index + 1) + "</td>",
                "<td><input data-role=\"start\" value=\"" + escapeAttr(global.SRT.formatTimecode(caption.start)) + "\"></td>",
                "<td><input data-role=\"end\" value=\"" + escapeAttr(global.SRT.formatTimecode(caption.end)) + "\"></td>",
                "<td><textarea data-role=\"text\">" + escapeHtml(caption.text || "") + "</textarea></td>",
                "<td><textarea data-role=\"translation\">" + escapeHtml(caption.translation || "") + "</textarea></td>"
            ].join("");
            bindRow(row, caption);
            body.appendChild(row);
        });
        $("captionCounter").textContent = state.captions.length + " 条";
    }

    function bindRow(row, caption) {
        row.querySelector("[data-role='select']").addEventListener("change", function (event) {
            if (event.target.checked) {
                state.selected[caption.id] = true;
            } else {
                delete state.selected[caption.id];
            }
            render();
        });

        ["start", "end", "text", "translation"].forEach(function (role) {
            row.querySelector("[data-role='" + role + "']").addEventListener("change", function (event) {
                if (role === "start" || role === "end") {
                    caption[role] = global.SRT.parseEditableTime(event.target.value);
                } else {
                    caption[role] = event.target.value;
                }
                sortCaptions();
                render();
            });
        });
    }

    function sortCaptions() {
        state.captions.sort(function (a, b) {
            return a.start - b.start;
        });
    }

    function selectedCaptions() {
        return state.captions.filter(function (caption) {
            return state.selected[caption.id];
        });
    }

    function replaceCaptions(captions) {
        state.captions = captions.map(function (caption) {
            return {
                id: caption.id || global.LocalOptimizer.makeId(),
                start: Number(caption.start) || 0,
                end: Number(caption.end) || 0,
                text: caption.text || "",
                translation: caption.translation || ""
            };
        });
        state.selected = {};
        sortCaptions();
        render();
    }

    function importSrtFile(event) {
        var file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var captions = global.SRT.parse(reader.result, {
                detectBilingual: $("detectBilingualInput").checked
            });
            replaceCaptions(captions);
            state.mediaPath = file.path || state.mediaPath;
            $("mediaPathInput").value = state.mediaPath;
            setStatus("已导入 SRT：" + captions.length + " 条");
            log("SRT 导入完成：" + captions.length + " 条。");
        };
        reader.readAsText(file, "utf-8");
        event.target.value = "";
    }

    function runTranscription() {
        var settings = getSettings();
        var inputPath = $("mediaPathInput").value.trim() || state.mediaPath;
        state.mediaPath = inputPath;
        if (!inputPath) {
            setStatus("请先选择音频/视频");
            return;
        }

        setBusy("本地处理中...");
        Promise.resolve().then(function () {
            if (!settings.separateVocals) {
                return inputPath;
            }
            log("开始人声分离。");
            return global.LocalServices.separateVocals(inputPath, settings, log);
        }).then(function (audioPath) {
            log("开始本地转录。");
            return global.LocalServices.transcribe(audioPath, settings, log);
        }).then(function (captions) {
            replaceCaptions(global.LocalOptimizer.segment(captions, settings));
            setStatus("转录完成：" + state.captions.length + " 条");
            log("转录完成。");
        }).catch(function (error) {
            setStatus("转录失败");
            logError(error);
        });
    }

    function readAeTextLayers() {
        setBusy("读取 AE 合成...");
        global.AEBridge.readTextLayers().then(function (captions) {
            replaceCaptions(captions);
            setStatus("已读取 AE 文字层：" + captions.length + " 条");
        }).catch(function (error) {
            setStatus("读取失败");
            logError(error);
        });
    }

    function runSegmentation() {
        var settings = getSettings();
        replaceCaptions(global.LocalOptimizer.segment(state.captions, settings));
        setStatus("断句完成：" + state.captions.length + " 条");
        log("本地断句完成。");
    }

    function runLocalOptimize() {
        var settings = getSettings();
        setBusy(settings.translate ? "本地优化/翻译..." : "本地优化...");
        global.LocalOptimizer.optimize(state.captions, settings, log).then(function (captions) {
            replaceCaptions(captions);
            setStatus("本地优化完成：" + captions.length + " 条");
        }).catch(function (error) {
            setStatus("本地优化失败");
            logError(error);
        });
    }

    function replaceAll() {
        var find = $("findInput").value;
        var replacement = $("replaceInput").value;
        if (!find) {
            return;
        }
        var pattern = new RegExp(escapeRegExp(find), "g");
        state.captions.forEach(function (caption) {
            caption.text = (caption.text || "").replace(pattern, replacement);
            caption.translation = (caption.translation || "").replace(pattern, replacement);
        });
        render();
        log("替换完成。");
    }

    function addRow() {
        var last = state.captions[state.captions.length - 1];
        var start = last ? last.end : 0;
        state.captions.push({
            id: global.LocalOptimizer.makeId(),
            start: start,
            end: start + 2,
            text: "",
            translation: ""
        });
        render();
    }

    function deleteRows() {
        var selected = selectedCaptions();
        if (!selected.length) {
            return;
        }
        state.captions = state.captions.filter(function (caption) {
            return !state.selected[caption.id];
        });
        state.selected = {};
        render();
    }

    function mergeRows() {
        var selected = selectedCaptions();
        if (selected.length < 2) {
            return;
        }
        selected.sort(function (a, b) {
            return a.start - b.start;
        });
        var merged = {
            id: global.LocalOptimizer.makeId(),
            start: selected[0].start,
            end: selected[selected.length - 1].end,
            text: selected.map(function (caption) { return caption.text; }).filter(Boolean).join(" "),
            translation: selected.map(function (caption) { return caption.translation; }).filter(Boolean).join(" ")
        };
        state.captions = state.captions.filter(function (caption) {
            return !state.selected[caption.id];
        });
        state.captions.push(merged);
        state.selected = {};
        sortCaptions();
        render();
    }

    function splitSelectedRow() {
        var selected = selectedCaptions();
        if (selected.length !== 1) {
            return;
        }
        var target = selected[0];
        var parts = global.LocalOptimizer.segment([target], getSettings());
        if (parts.length < 2) {
            return;
        }
        state.captions = state.captions.filter(function (caption) {
            return caption.id !== target.id;
        }).concat(parts);
        state.selected = {};
        sortCaptions();
        render();
    }

    function importToAe() {
        var settings = getSettings();
        setBusy("导入 AE...");
        global.AEBridge.importCaptions({
            captions: state.captions,
            mode: settings.layerMode,
            displayMode: settings.displayMode,
            style: styleSettings(settings)
        }).then(function (result) {
            setStatus("已导入 AE：" + result.count + " 条");
            log("AE 导入完成。");
        }).catch(function (error) {
            setStatus("AE 导入失败");
            logError(error);
        });
    }

    function exportSrt() {
        var settings = getSettings();
        var base = global.LocalServices.basenameWithoutExt(state.mediaPath);
        var modeName = settings.displayMode.replace(/[^a-z-]/g, "");
        var path = global.LocalServices.defaultExportPath(base + "_" + modeName, ".srt");
        var text = global.SRT.serialize(state.captions, settings.displayMode);
        try {
            global.LocalServices.writeText(path, text);
            setStatus("已导出 SRT");
            log("已导出：" + path);
        } catch (error) {
            setStatus("导出失败");
            logError(error);
        }
    }

    function saveProject() {
        var base = global.LocalServices.basenameWithoutExt(state.mediaPath);
        var path = global.LocalServices.defaultExportPath(base + "_caption_project", ".json");
        var payload = {
            version: 1,
            mediaPath: state.mediaPath,
            captions: state.captions,
            settings: getSettings()
        };
        try {
            global.LocalServices.writeText(path, JSON.stringify(payload, null, 2));
            setStatus("草稿已保存");
            log("草稿已保存：" + path);
        } catch (error) {
            logError(error);
        }
    }

    function loadProject(event) {
        var file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var payload = JSON.parse(reader.result);
                state.mediaPath = payload.mediaPath || "";
                replaceCaptions(payload.captions || []);
                setStatus("草稿已打开");
                log("草稿已打开：" + (file.path || file.name));
            } catch (error) {
                logError(error);
            }
        };
        reader.readAsText(file, "utf-8");
        event.target.value = "";
    }

    function setBusy(text) {
        setStatus(text);
        log(text);
    }

    function setStatus(text) {
        $("statusText").textContent = text;
    }

    function log(message) {
        if (!message) {
            return;
        }
        var output = $("logOutput");
        output.textContent += "[" + new Date().toLocaleTimeString() + "] " + String(message).trim() + "\n";
        output.scrollTop = output.scrollHeight;
    }

    function logError(error) {
        var message = error && error.message ? error.message : String(error);
        if (message.indexOf("No module named 'faster_whisper'") !== -1 || message.indexOf('No module named "faster_whisper"') !== -1) {
            log("错误：当前 Python 没有安装 faster-whisper。请在插件文件夹里双击 INSTALL_SPEECH_DEPS.cmd，安装完成后重启 AE。");
            return;
        }
        log("错误：" + message);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/'/g, "&#39;");
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    document.addEventListener("DOMContentLoaded", init);
})(window);
