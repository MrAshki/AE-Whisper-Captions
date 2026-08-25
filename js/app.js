(function (global) {
    "use strict";

    var state = {
        captions: [],
        sourceWords: [],
        mediaPath: "",
        selected: {},
        restoredSettings: {},
        previewCaptionId: null,
        previewWordIndex: -1,
        previewMediaPath: ""
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
        "wordHighlightScaleInput",
        "layerModeInput",
        "displayModeInput",
        "baseFontInput",
        "baseFontSizeInput",
        "activeFontInput",
        "activeFontSizeInput",
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
        loadAfterEffectsFonts();
        updatePreviewMedia();
    }

    function bindEvents() {
        $("mediaFileInput").addEventListener("change", function (event) {
            var file = event.target.files && event.target.files[0];
            state.mediaPath = file ? (file.path || file.name) : "";
            $("mediaPathInput").value = state.mediaPath;
            setStatus(state.mediaPath ? "Selected: " + state.mediaPath : "Ready");
            persistSettings();
            updatePreviewMedia();
        });

        $("mediaPathInput").addEventListener("input", function (event) {
            state.mediaPath = event.target.value.trim();
            persistSettings();
        });
        $("mediaPathInput").addEventListener("change", updatePreviewMedia);

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
        $("styleTabBtn").addEventListener("click", function () {
            showSettingsTab("style");
        });
        $("fontTabBtn").addEventListener("click", function () {
            showSettingsTab("font");
        });
        $("refreshFontsBtn").addEventListener("click", loadAfterEffectsFonts);
        bindPreviewEvents();

        fields.forEach(function (id) {
            var el = $(id);
            if (el) {
                el.addEventListener("change", persistSettings);
                el.addEventListener("input", persistSettings);
                el.addEventListener("change", function () { syncPreview(true); });
                el.addEventListener("input", function () { syncPreview(true); });
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
            wordHighlightScale: Number($("wordHighlightScaleInput").value) || 112,
            layerMode: $("layerModeInput").value,
            displayMode: $("displayModeInput").value,
            baseFont: $("baseFontInput").value,
            baseFontSize: Number($("baseFontSizeInput").value) || 64,
            activeFont: $("activeFontInput").value,
            activeFontSize: Number($("activeFontSizeInput").value) || Number($("baseFontSizeInput").value) || 64,
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
            font: settings.baseFont,
            fontSize: settings.baseFontSize,
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
            state.restoredSettings = snapshot.settings || {};
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
            if (!snapshot.settings.baseFontSizeInput && snapshot.settings.fontSizeInput) {
                $("baseFontSizeInput").value = snapshot.settings.fontSizeInput;
            }
            if (!snapshot.settings.activeFontSizeInput && snapshot.settings.fontSizeInput) {
                $("activeFontSizeInput").value = snapshot.settings.fontSizeInput;
            }
            state.mediaPath = snapshot.mediaPath || "";
            if ($("mediaPathInput") && !snapshot.settings.mediaPathInput) {
                $("mediaPathInput").value = state.mediaPath;
            }
        } catch (error) {
            log("Failed to read settings: " + error.message);
        }
    }

    function showSettingsTab(name) {
        var showFont = name === "font";
        $("styleTabBtn").classList.toggle("active", !showFont);
        $("fontTabBtn").classList.toggle("active", showFont);
        $("styleTabBtn").setAttribute("aria-selected", String(!showFont));
        $("fontTabBtn").setAttribute("aria-selected", String(showFont));
        $("styleTabPanel").hidden = showFont;
        $("fontTabPanel").hidden = !showFont;
    }

    function normalizedFontLabel(value) {
        return String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase();
    }

    function requestedFontValue(fonts, requested) {
        var target = normalizedFontLabel(requested);
        if (!target) {
            return "";
        }
        for (var i = 0; i < fonts.length; i += 1) {
            var font = fonts[i];
            var labels = [font.postScriptName, font.fullName, font.familyName, font.label];
            for (var j = 0; j < labels.length; j += 1) {
                if (normalizedFontLabel(labels[j]) === target) {
                    return font.postScriptName;
                }
            }
        }
        return "";
    }

    function populateFontSelect(select, fonts, emptyLabel, requested, fallback) {
        select.innerHTML = "";
        var defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = emptyLabel;
        select.appendChild(defaultOption);
        fonts.forEach(function (font) {
            var option = document.createElement("option");
            option.value = font.postScriptName;
            option.textContent = font.label || font.fullName || font.postScriptName;
            select.appendChild(option);
        });
        select.value = requestedFontValue(fonts, requested) || requestedFontValue(fonts, fallback) || "";
        select.disabled = false;
        select.setAttribute("data-fonts-loaded", "true");
    }

    function loadAfterEffectsFonts() {
        var baseSelect = $("baseFontInput");
        var activeSelect = $("activeFontInput");
        var currentBase = baseSelect.getAttribute("data-fonts-loaded") === "true" ? baseSelect.value :
            (state.restoredSettings.baseFontInput || state.restoredSettings.fontInput || "");
        var currentActive = activeSelect.getAttribute("data-fonts-loaded") === "true" ? activeSelect.value :
            (state.restoredSettings.activeFontInput || "");
        baseSelect.disabled = true;
        activeSelect.disabled = true;
        global.AEBridge.listFonts().then(function (result) {
            var fonts = result.fonts || [];
            populateFontSelect(baseSelect, fonts, "After Effects Default", currentBase, result.preferredBase);
            populateFontSelect(activeSelect, fonts, "Same as Base Font", currentActive, result.preferredActive);
            persistSettings();
            log("Loaded " + fonts.length + " After Effects fonts.");
        }).catch(function (error) {
            baseSelect.disabled = false;
            activeSelect.disabled = false;
            baseSelect.innerHTML = "<option value=\"\">After Effects Default</option>";
            activeSelect.innerHTML = "<option value=\"\">Same as Base Font</option>";
            log("Could not load After Effects fonts: " + error.message);
        });
    }

    function bindPreviewEvents() {
        var video = $("previewVideo");
        var overlay = $("previewCaption");
        var editor = $("previewTextInput");

        video.addEventListener("timeupdate", function () { syncPreview(false); });
        video.addEventListener("seeked", function () { syncPreview(true); });
        video.addEventListener("loadedmetadata", function () {
            $("previewEmpty").style.display = "none";
            syncPreview(true);
        });
        video.addEventListener("error", function () {
            $("previewEmpty").textContent = "This media codec cannot be previewed";
            $("previewEmpty").style.display = "flex";
            log("Preview could not open this media codec.");
        });

        overlay.addEventListener("focus", function () {
            video.pause();
            var caption = previewCaption();
            if (caption) {
                overlay.textContent = previewDisplayText(caption);
            }
        });
        overlay.addEventListener("input", function () {
            updatePreviewCaptionText(overlay.innerText || overlay.textContent || "");
        });
        overlay.addEventListener("blur", function () {
            syncPreview(true);
        });
        editor.addEventListener("focus", function () {
            video.pause();
        });
        editor.addEventListener("input", function () {
            updatePreviewCaptionText(editor.value);
            syncPreview(true);
        });

        $("previousCaptionBtn").addEventListener("click", function () { movePreviewCaption(-1); });
        $("nextCaptionBtn").addEventListener("click", function () { movePreviewCaption(1); });
        $("setCaptionStartBtn").addEventListener("click", function () { setPreviewBoundary("start"); });
        $("setCaptionEndBtn").addEventListener("click", function () { setPreviewBoundary("end"); });
    }

    function mediaFileUrl(path) {
        var normalized = String(path || "").replace(/\\/g, "/");
        if (!normalized) {
            return "";
        }
        if (/^file:\/\//i.test(normalized)) {
            return normalized;
        }
        var parts = normalized.split("/");
        for (var i = 0; i < parts.length; i += 1) {
            if (i === 0 && /^[a-z]:$/i.test(parts[i])) {
                continue;
            }
            parts[i] = encodeURIComponent(parts[i]);
        }
        return "file:///" + parts.join("/");
    }

    function updatePreviewMedia() {
        var path = ($("mediaPathInput").value || state.mediaPath || "").trim();
        if (path === state.previewMediaPath) {
            return;
        }
        state.previewMediaPath = path;
        state.previewCaptionId = null;
        state.previewWordIndex = -1;
        var video = $("previewVideo");
        video.pause();
        video.removeAttribute("src");
        video.load();
        $("previewEmpty").textContent = path ? "Loading preview..." : "Select an audio or video file";
        $("previewEmpty").style.display = "flex";
        if (path) {
            video.src = mediaFileUrl(path);
            video.load();
        }
        syncPreview(true);
    }

    function previewCaption() {
        for (var i = 0; i < state.captions.length; i += 1) {
            if (state.captions[i].id === state.previewCaptionId) {
                return state.captions[i];
            }
        }
        return null;
    }

    function captionAtTime(time) {
        for (var i = 0; i < state.captions.length; i += 1) {
            if (time >= state.captions[i].start && time < state.captions[i].end) {
                return state.captions[i];
            }
        }
        return null;
    }

    function previewDisplayText(caption) {
        var mode = $("displayModeInput").value;
        var source = caption.text || "";
        var translation = caption.translation || "";
        if (mode === "translation") {
            return translation || source;
        }
        if (mode === "source-top") {
            return translation ? source + "\n" + translation : source;
        }
        if (mode === "translation-top") {
            return translation ? translation + "\n" + source : source;
        }
        return source;
    }

    function activePreviewWord(caption, time) {
        var words = caption.words || [];
        for (var i = 0; i < words.length; i += 1) {
            if (time >= words[i].start && time < words[i].end) {
                return i;
            }
        }
        return -1;
    }

    function selectedFontFamily(select) {
        if (select.value) {
            return select.value;
        }
        return "sans-serif";
    }

    function previewFontPixels(size) {
        var stageHeight = $("previewVideo").clientHeight || 270;
        return Math.max(12, Math.min(96, Number(size || 64) * stageHeight / 1080));
    }

    function applyPreviewStyle(settings) {
        var overlay = $("previewCaption");
        var strokeWidth = Math.max(0, Number(settings.strokeWidth) || 0) * 0.35;
        overlay.style.left = settings.positionX + "%";
        overlay.style.top = settings.positionY + "%";
        overlay.style.color = settings.fillColor;
        overlay.style.fontFamily = selectedFontFamily($("baseFontInput"));
        overlay.style.fontSize = previewFontPixels(settings.baseFontSize) + "px";
        overlay.style.webkitTextStroke = strokeWidth + "px " + settings.strokeColor;
        overlay.style.textShadow = settings.shadow ? "0 3px 6px rgba(0, 0, 0, 0.8)" : "none";
    }

    function renderPreviewWords(caption, time, settings) {
        var overlay = $("previewCaption");
        var text = previewDisplayText(caption);
        var words = caption.words || [];
        var activeIndex = activePreviewWord(caption, time);
        if (!settings.wordHighlightEnabled || $("displayModeInput").value !== "source" || !words.length) {
            overlay.textContent = text;
            return activeIndex;
        }
        var cursor = 0;
        var matched = 0;
        overlay.textContent = "";
        for (var i = 0; i < words.length; i += 1) {
            var wordText = String(words[i].text || "").trim();
            var start = text.indexOf(wordText, cursor);
            if (!wordText || start < 0) {
                continue;
            }
            overlay.appendChild(document.createTextNode(text.slice(cursor, start)));
            var span = document.createElement("span");
            span.className = "preview-word" + (i === activeIndex ? " active" : "");
            span.textContent = text.slice(start, start + wordText.length);
            if (i === activeIndex) {
                span.style.color = settings.wordHighlightColor;
                span.style.fontFamily = selectedFontFamily($("activeFontInput"));
                span.style.fontSize = previewFontPixels(settings.activeFontSize) + "px";
                span.style.transform = "scale(" + (settings.wordHighlightScale / 100) + ")";
            }
            overlay.appendChild(span);
            cursor = start + wordText.length;
            matched += 1;
        }
        if (!matched) {
            overlay.textContent = text;
        } else {
            overlay.appendChild(document.createTextNode(text.slice(cursor)));
        }
        return activeIndex;
    }

    function updatePlaybackRow(captionId, shouldScroll) {
        var rows = $("captionBody").children;
        for (var i = 0; i < rows.length; i += 1) {
            var active = rows[i]._captionId === captionId;
            rows[i].classList.toggle("playback-active", active);
            if (active && shouldScroll && rows[i].scrollIntoView) {
                try {
                    rows[i].scrollIntoView({ block: "nearest" });
                } catch (error) {
                    rows[i].scrollIntoView(false);
                }
            }
        }
    }

    function syncPreview(force) {
        var video = $("previewVideo");
        var time = isFinite(video.currentTime) ? video.currentTime : 0;
        $("previewTime").textContent = global.SRT.formatTimecode(time);
        var caption = captionAtTime(time);
        var changed = (!caption && state.previewCaptionId !== null) || (caption && caption.id !== state.previewCaptionId);
        if (changed) {
            state.previewCaptionId = caption ? caption.id : null;
            state.previewWordIndex = -1;
        }
        caption = previewCaption();
        var overlay = $("previewCaption");
        var editor = $("previewTextInput");
        if (!caption) {
            if (document.activeElement !== overlay) {
                overlay.textContent = "";
            }
            overlay.setAttribute("contenteditable", "false");
            editor.value = "";
            editor.disabled = true;
            $("previewCaptionNumber").textContent = "No active caption";
            updatePlaybackRow(null, false);
            return;
        }
        var index = state.captions.indexOf(caption);
        $("previewCaptionNumber").textContent = "Caption " + (index + 1) + " of " + state.captions.length;
        overlay.setAttribute("contenteditable", "true");
        editor.disabled = false;
        if (changed || document.activeElement !== editor) {
            editor.value = previewDisplayText(caption);
        }
        var settings = getSettings();
        applyPreviewStyle(settings);
        var wordIndex = activePreviewWord(caption, time);
        if (document.activeElement !== overlay && (force || changed || wordIndex !== state.previewWordIndex)) {
            state.previewWordIndex = renderPreviewWords(caption, time, settings);
        }
        updatePlaybackRow(caption.id, changed && !video.paused);
    }

    function updateMasterWords(captionWords) {
        for (var i = 0; i < captionWords.length; i += 1) {
            for (var j = 0; j < state.sourceWords.length; j += 1) {
                if (Math.abs(state.sourceWords[j].start - captionWords[i].start) < 0.001 &&
                    Math.abs(state.sourceWords[j].end - captionWords[i].end) < 0.001) {
                    state.sourceWords[j].text = captionWords[i].text;
                    break;
                }
            }
        }
    }

    function updateOriginalCaptionText(caption, text) {
        var words = caption.words || [];
        var tokens = String(text || "").trim().split(/\s+/).filter(Boolean);
        if (words.length && tokens.length === words.length) {
            for (var i = 0; i < words.length; i += 1) {
                words[i].text = tokens[i];
            }
            updateMasterWords(words);
        } else if (words.length && tokens.length !== words.length) {
            delete caption.words;
        }
        caption.text = text;
    }

    function updatePreviewCaptionText(value) {
        var caption = previewCaption();
        if (!caption) {
            return;
        }
        var mode = $("displayModeInput").value;
        var text = String(value || "").replace(/\r\n/g, "\n");
        if (mode === "translation") {
            caption.translation = text;
        } else if (mode === "source-top" || mode === "translation-top") {
            var lines = text.split("\n");
            var first = lines.shift() || "";
            var rest = lines.join("\n");
            if (mode === "source-top") {
                updateOriginalCaptionText(caption, first);
                caption.translation = rest;
            } else {
                caption.translation = first;
                updateOriginalCaptionText(caption, rest);
            }
        } else {
            updateOriginalCaptionText(caption, text);
        }
        if (document.activeElement !== $("previewTextInput")) {
            $("previewTextInput").value = previewDisplayText(caption);
        }
        updateCaptionRow(caption);
    }

    function updateCaptionRow(caption) {
        var rows = $("captionBody").children;
        for (var i = 0; i < rows.length; i += 1) {
            if (rows[i]._captionId === caption.id) {
                rows[i].querySelector("[data-role='text']").value = caption.text || "";
                rows[i].querySelector("[data-role='translation']").value = caption.translation || "";
                rows[i].querySelector("[data-role='start']").value = global.SRT.formatTimecode(caption.start);
                rows[i].querySelector("[data-role='end']").value = global.SRT.formatTimecode(caption.end);
                break;
            }
        }
    }

    function seekToCaption(caption) {
        if (!caption) {
            return;
        }
        var video = $("previewVideo");
        try {
            video.currentTime = Math.max(0, caption.start + 0.001);
        } catch (error) {}
        state.previewCaptionId = caption.id;
        syncPreview(true);
    }

    function movePreviewCaption(direction) {
        if (!state.captions.length) {
            return;
        }
        var caption = previewCaption();
        var index = caption ? state.captions.indexOf(caption) : (direction > 0 ? -1 : state.captions.length);
        index = Math.max(0, Math.min(state.captions.length - 1, index + direction));
        seekToCaption(state.captions[index]);
    }

    function setPreviewBoundary(boundary) {
        var caption = previewCaption();
        if (!caption) {
            return;
        }
        var time = Math.max(0, $("previewVideo").currentTime || 0);
        if (boundary === "start") {
            caption.start = Math.max(0, Math.min(time, caption.end - 0.04));
        } else {
            caption.end = Math.max(time, caption.start + 0.04);
        }
        sortCaptions();
        render();
        state.previewCaptionId = caption.id;
        syncPreview(true);
    }

    function render() {
        var body = $("captionBody");
        body.innerHTML = "";
        state.captions.forEach(function (caption, index) {
            var row = document.createElement("tr");
            row._captionId = caption.id;
            if (state.selected[caption.id]) {
                row.className = "selected";
            }
            if (state.previewCaptionId === caption.id) {
                row.classList.add("playback-active");
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
        row.querySelector(".row-index").addEventListener("click", function () {
            seekToCaption(caption);
        });
        row.querySelector("[data-role='select']").addEventListener("change", function (event) {
            if (event.target.checked) {
                state.selected[caption.id] = true;
            } else {
                delete state.selected[caption.id];
            }
            render();
        });

        ["start", "end", "text", "translation"].forEach(function (role) {
            row.querySelector("[data-role='" + role + "']").addEventListener("focus", function () {
                $("previewVideo").pause();
                seekToCaption(caption);
            });
            row.querySelector("[data-role='" + role + "']").addEventListener("change", function (event) {
                if (role === "start" || role === "end") {
                    caption[role] = global.SRT.parseEditableTime(event.target.value);
                } else if (role === "text") {
                    updateOriginalCaptionText(caption, event.target.value);
                } else {
                    caption[role] = event.target.value;
                }
                sortCaptions();
                render();
                state.previewCaptionId = caption.id;
                syncPreview(true);
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
        syncPreview(true);
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
                color: settings.wordHighlightColor,
                scale: settings.wordHighlightScale
            },
            fontPreferences: {
                base: {
                    name: settings.baseFont,
                    size: settings.baseFontSize
                },
                active: {
                    name: settings.activeFont,
                    size: settings.activeFontSize
                }
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
                $("mediaPathInput").value = state.mediaPath;
                updatePreviewMedia();
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
