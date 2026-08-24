(function (global) {
    "use strict";

    var state = {
        captions: [],
        sourceWords: [],
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
        "maxWordsInput",
        "groupMaxCharsInput",
        "pauseSplitInput",
        "maxDurationInput",
        "minDurationInput",
        "wordHighlightEnabledInput",
        "wordHighlightColorInput",
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
        log("Plugin is ready.");
    }

    function bindEvents() {
        $("mediaFileInput").addEventListener("change", function (event) {
            var file = event.target.files && event.target.files[0];
            state.mediaPath = file ? (file.path || file.name) : "";
            $("mediaPathInput").value = state.mediaPath;
            setStatus(state.mediaPath ? "Selected: " + state.mediaPath : "Ready");
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
            maxWords: Number($("maxWordsInput").value) || 4,
            groupMaxChars: Number($("groupMaxCharsInput").value) || 28,
            pauseSplit: Number($("pauseSplitInput").value) || 0.35,
            maxDuration: Number($("maxDurationInput").value) || 2.5,
            minDuration: Number($("minDurationInput").value) || 0.4,
            wordHighlightEnabled: $("wordHighlightEnabledInput").checked,
            wordHighlightColor: $("wordHighlightColorInput").value || "#FFD54A",
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
            log("Failed to read settings: " + error.message);
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
        $("captionCounter").textContent = state.captions.length + " lines";
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

    function replaceCaptions(captions, options) {
        options = options || {};
        if (options.clearSourceWords) {
            state.sourceWords = [];
        } else if (options.sourceWords) {
            state.sourceWords = global.LocalOptimizer.normalizeWords(options.sourceWords);
        }
        state.captions = captions.map(function (caption) {
            var row = {
                id: caption.id || global.LocalOptimizer.makeId(),
                start: Number(caption.start) || 0,
                end: Number(caption.end) || 0,
                text: caption.text || "",
                translation: caption.translation || ""
            };
            if (caption.words && caption.words.length) {
                row.words = global.LocalOptimizer.normalizeWords(caption.words);
            }
            return row;
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
            replaceCaptions(captions, { clearSourceWords: true });
            state.mediaPath = file.path || state.mediaPath;
            $("mediaPathInput").value = state.mediaPath;
            setStatus("Imported SRT: " + captions.length + " lines");
            log("SRT import complete: " + captions.length + " lines.");
        };
        reader.readAsText(file, "utf-8");
        event.target.value = "";
    }

    function runTranscription() {
        var settings = getSettings();
        var inputPath = $("mediaPathInput").value.trim() || state.mediaPath;
        state.mediaPath = inputPath;
        if (!inputPath) {
            setStatus("Select an audio or video file first");
            return;
        }

        setBusy("Processing locally...");
        Promise.resolve().then(function () {
            if (!settings.separateVocals) {
                return inputPath;
            }
            log("Starting vocal separation.");
            return global.LocalServices.separateVocals(inputPath, settings, log);
        }).then(function (audioPath) {
            log("Starting local transcription.");
            return global.LocalServices.transcribe(audioPath, settings, log);
        }).then(function (result) {
            var captions;
            if (result && result.sourceWords && result.sourceWords.length) {
                state.sourceWords = global.LocalOptimizer.normalizeWords(result.sourceWords);
                captions = global.LocalOptimizer.groupWords(state.sourceWords, settings);
                replaceCaptions(captions, { sourceWords: state.sourceWords });
                log("Word timeline loaded: " + state.sourceWords.length + " words.");
            } else {
                state.sourceWords = [];
                captions = global.LocalOptimizer.segment(result || [], settings);
                replaceCaptions(captions, { clearSourceWords: true });
            }
            setStatus("Transcription complete: " + state.captions.length + " lines");
            log("Transcription complete.");
        }).catch(function (error) {
            setStatus("Transcription failed");
            logError(error);
        });
    }

    function readAeTextLayers() {
        setBusy("Reading AE composition...");
        global.AEBridge.readTextLayers().then(function (captions) {
            replaceCaptions(captions, { clearSourceWords: true });
            setStatus("Read AE text layers: " + captions.length + " lines");
        }).catch(function (error) {
            setStatus("Read failed");
            logError(error);
        });
    }

    function runSegmentation() {
        var settings = getSettings();
        var captions = global.LocalOptimizer.segment(state.captions, settings, state.sourceWords);
        replaceCaptions(captions, state.sourceWords.length ? { sourceWords: state.sourceWords } : {});
        setStatus("Segmentation complete: " + state.captions.length + " lines");
        log(state.sourceWords.length ? "Regrouped from word timeline." : "Local segmentation complete.");
    }

    function runLocalOptimize() {
        var settings = getSettings();
        setBusy(settings.translate ? "Local optimize / translate..." : "Local optimize...");
        global.LocalOptimizer.optimize(state.captions, settings, log, state.sourceWords).then(function (captions) {
            replaceCaptions(captions, state.sourceWords.length ? { sourceWords: state.sourceWords } : {});
            setStatus("Local optimize complete: " + captions.length + " lines");
        }).catch(function (error) {
            setStatus("Local optimize failed");
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
        log("Replace complete.");
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
            translation: selected.map(function (caption) { return caption.translation; }).filter(Boolean).join(" "),
            words: global.LocalOptimizer.normalizeWords(selected.reduce(function (words, caption) {
                return words.concat(caption.words || []);
            }, []))
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
        setBusy("Importing to AE...");
        global.AEBridge.importCaptions({
            captions: state.captions,
            mode: settings.layerMode,
            displayMode: settings.displayMode,
            wordHighlight: {
                enabled: settings.wordHighlightEnabled,
                color: settings.wordHighlightColor
            },
            style: styleSettings(settings)
        }).then(function (result) {
            setStatus("Imported to AE: " + result.count + " lines");
            log("AE import complete.");
        }).catch(function (error) {
            setStatus("AE import failed");
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
            setStatus("Exported SRT");
            log("Exported: " + path);
        } catch (error) {
            setStatus("Export failed");
            logError(error);
        }
    }

    function saveProject() {
        var base = global.LocalServices.basenameWithoutExt(state.mediaPath);
        var path = global.LocalServices.defaultExportPath(base + "_caption_project", ".json");
        var payload = {
            version: 2,
            mediaPath: state.mediaPath,
            sourceWords: state.sourceWords,
            captions: state.captions,
            settings: getSettings()
        };
        try {
            global.LocalServices.writeText(path, JSON.stringify(payload, null, 2));
            setStatus("Draft saved");
            log("Draft saved: " + path);
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
                replaceCaptions(payload.captions || [], { sourceWords: payload.sourceWords || [] });
                setStatus("Draft opened");
                log("Draft opened: " + (file.path || file.name));
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
            log("Error: faster-whisper is not installed in the current Python environment. Double-click INSTALL_SPEECH_DEPS.cmd in the extension folder, then restart AE.");
            return;
        }
        log("Error: " + message);
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
