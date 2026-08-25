var AESubtitleAI = AESubtitleAI || {};

(function () {
    function stringify(value) {
        if (typeof JSON !== "undefined" && JSON.stringify) {
            return JSON.stringify(value);
        }
        if (value === null) {
            return "null";
        }
        var type = typeof value;
        if (type === "string") {
            return "\"" + value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + "\"";
        }
        if (type === "number" || type === "boolean") {
            return String(value);
        }
        if (value instanceof Array) {
            var parts = [];
            for (var i = 0; i < value.length; i += 1) {
                parts.push(stringify(value[i]));
            }
            return "[" + parts.join(",") + "]";
        }
        var fields = [];
        for (var key in value) {
            if (value.hasOwnProperty(key)) {
                fields.push(stringify(key) + ":" + stringify(value[key]));
            }
        }
        return "{" + fields.join(",") + "}";
    }

    function parseJSON(text) {
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(text);
        }
        return eval("(" + text + ")");
    }

    function ok(data) {
        return stringify({ ok: true, data: data });
    }

    function fail(error) {
        return stringify({ ok: false, error: String(error) });
    }

    function activeComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            throw new Error("Open and select an AE composition first");
        }
        return item;
    }

    function getSourceText(layer) {
        try {
            return layer.property("Source Text");
        } catch (error) {
            return null;
        }
    }

    function textFromDocument(doc) {
        if (!doc) {
            return "";
        }
        try {
            return doc.text || "";
        } catch (error) {
            return String(doc);
        }
    }

    function hexToRgb(hex, fallback) {
        hex = String(hex || "").replace("#", "");
        if (hex.length !== 6) {
            return fallback;
        }
        return [
            parseInt(hex.substr(0, 2), 16) / 255,
            parseInt(hex.substr(2, 2), 16) / 255,
            parseInt(hex.substr(4, 2), 16) / 255
        ];
    }

    function finiteNumber(value) {
        var number = Number(value);
        return isFinite(number) ? number : null;
    }

    function clampTime(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function fillStyle(style, fillColor) {
        var copy = {};
        for (var key in style) {
            if (style.hasOwnProperty(key)) {
                copy[key] = style[key];
            }
        }
        copy.fillColor = fillColor;
        return copy;
    }

    function normalizedHighlight(payload) {
        payload = payload || {};
        var scale = Number(payload.scale);
        if (!isFinite(scale)) {
            scale = 112;
        }
        scale = Math.max(100, Math.min(160, scale));
        return {
            enabled: !!payload.enabled,
            color: payload.color || "#FFD54A",
            scale: scale
        };
    }

    function validCaptionWords(caption) {
        var words = [];
        var source = caption && caption.words ? caption.words : [];
        for (var i = 0; i < source.length; i += 1) {
            var word = source[i] || {};
            var text = String(word.text || "").replace(/^\s+|\s+$/g, "");
            var start = finiteNumber(word.start);
            var end = finiteNumber(word.end);
            if (!text || start === null || end === null || end <= start) {
                continue;
            }
            words.push({
                text: text,
                start: start,
                end: end
            });
        }
        return words;
    }

    function displayText(caption, mode) {
        var source = caption.text || "";
        var translation = caption.translation || "";
        if (mode === "translation") {
            return translation || source;
        }
        if (mode === "source-top") {
            return translation ? source + "\r" + translation : source;
        }
        if (mode === "translation-top") {
            return translation ? translation + "\r" + source : source;
        }
        return source;
    }

    function applyTextStyle(layer, text, style, comp) {
        var textProp = getSourceText(layer);
        var doc = textProp.value;
        doc.text = text;
        doc.applyFill = true;
        doc.fillColor = hexToRgb(style.fillColor, [1, 1, 1]);
        doc.applyStroke = Number(style.strokeWidth) > 0;
        doc.strokeColor = hexToRgb(style.strokeColor, [0, 0, 0]);
        doc.strokeWidth = Number(style.strokeWidth) || 0;
        doc.strokeOverFill = false;
        doc.fontSize = Number(style.fontSize) || 64;
        try {
            if (style.font) {
                doc.font = style.font;
            }
        } catch (fontError) {}
        try {
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
        } catch (justifyError) {}
        textProp.setValue(doc);
        setLayerPosition(layer, style, comp);
        if (style.shadow) {
            applyShadow(layer);
        }
    }

    function makeTextDocument(text, style) {
        var doc = new TextDocument(text);
        doc.applyFill = true;
        doc.fillColor = hexToRgb(style.fillColor, [1, 1, 1]);
        doc.applyStroke = Number(style.strokeWidth) > 0;
        doc.strokeColor = hexToRgb(style.strokeColor, [0, 0, 0]);
        doc.strokeWidth = Number(style.strokeWidth) || 0;
        doc.strokeOverFill = false;
        doc.fontSize = Number(style.fontSize) || 64;
        try {
            if (style.font) {
                doc.font = style.font;
            }
        } catch (fontError) {}
        try {
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
        } catch (justifyError) {}
        return doc;
    }

    function setLayerPosition(layer, style, comp) {
        var x = comp.width * ((Number(style.positionX) || 50) / 100);
        var y = comp.height * ((Number(style.positionY) || 86) / 100);
        try {
            layer.property("Position").setValue([x, y]);
        } catch (error) {}
    }

    function applyShadow(layer) {
        try {
            var effects = layer.property("ADBE Effect Parade");
            var shadow = effects.addProperty("ADBE Drop Shadow");
            shadow.property(1).setValue([0, 0, 0]);
            shadow.property(2).setValue(70);
            shadow.property(3).setValue(135);
            shadow.property(4).setValue(8);
            shadow.property(5).setValue(18);
        } catch (error) {}
    }

    function setHoldKeys(prop) {
        if (!prop || !prop.numKeys) {
            return;
        }
        for (var i = 1; i <= prop.numKeys; i += 1) {
            try {
                prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            } catch (error) {}
        }
    }

    function setBezierKeys(prop) {
        if (!prop || !prop.numKeys) {
            return;
        }
        for (var i = 1; i <= prop.numKeys; i += 1) {
            try {
                prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            } catch (error) {}
        }
    }

    function removeProperty(prop) {
        try {
            if (prop && prop.remove) {
                prop.remove();
            }
        } catch (error) {}
    }

    function frameTransition(layer, start, end) {
        var duration = Math.max(0, end - start);
        var frameDuration = 1 / (layer.containingComp ? layer.containingComp.frameRate : 25);
        return Math.min(frameDuration * 3, duration / 3);
    }

    function addScaleEnvelope(scaleProp, layer, start, end, activeScale) {
        if (!scaleProp || activeScale <= 100) {
            return;
        }
        var transition = frameTransition(layer, start, end);
        var active = [activeScale, activeScale, 100];
        var normal = [100, 100, 100];
        var inEnd = start + transition;
        var outStart = end - transition;
        scaleProp.setValueAtTime(start, normal);
        scaleProp.setValueAtTime(inEnd, active);
        scaleProp.setValueAtTime(outStart, active);
        scaleProp.setValueAtTime(end, normal);
    }

    function applyWordHighlight(layer, caption, highlight) {
        var words = validCaptionWords(caption);
        if (!highlight.enabled || words.length < 2) {
            return false;
        }

        var layerStart = layer.inPoint;
        var layerEnd = layer.outPoint;
        var animator = null;
        try {
            var textProps = layer.property("ADBE Text Properties");
            var animators = textProps.property("ADBE Text Animators");
            animator = animators.addProperty("ADBE Text Animator");
            animator.name = "Active Word Highlight";

            var animatorProps = animator.property("ADBE Text Animator Properties");
            var fill = animatorProps.addProperty("ADBE Text Fill Color");
            fill.setValue(hexToRgb(highlight.color, [1, 0.835294, 0.290196]));
            var scale = null;
            if (highlight.scale > 100) {
                scale = animatorProps.addProperty("ADBE Text Scale 3D");
                scale.setValue([100, 100, 100]);
            }

            var selectors = animator.property("ADBE Text Selectors");
            var selector = selectors.addProperty("ADBE Text Selector");
            selector.name = "Active Word Selector";

            var advanced = selector.property("ADBE Text Range Advanced");
            advanced.property("ADBE Text Range Units").setValue(2);
            advanced.property("ADBE Text Range Type2").setValue(3);

            var indexStart = selector.property("ADBE Text Index Start");
            var indexEnd = selector.property("ADBE Text Index End");
            indexStart.setValue(0);
            indexEnd.setValue(0);

            var keyCount = 0;
            for (var i = 0; i < words.length; i += 1) {
                var start = clampTime(words[i].start, layerStart, layerEnd);
                var end = clampTime(words[i].end, layerStart, layerEnd);
                if (end <= start) {
                    continue;
                }
                if (!keyCount && start > layerStart) {
                    indexStart.setValueAtTime(layerStart, 0);
                    indexEnd.setValueAtTime(layerStart, 0);
                }
                indexStart.setValueAtTime(start, i);
                indexEnd.setValueAtTime(start, i + 1);
                addScaleEnvelope(scale, layer, start, end, highlight.scale);
                if (i === words.length - 1 || words[i + 1].start > end + 0.001) {
                    indexStart.setValueAtTime(end, 0);
                    indexEnd.setValueAtTime(end, 0);
                }
                keyCount += 1;
            }

            if (!keyCount) {
                removeProperty(animator);
                return false;
            }

            setHoldKeys(indexStart);
            setHoldKeys(indexEnd);
            setBezierKeys(scale);
            return true;
        } catch (error) {
            removeProperty(animator);
            return false;
        }
    }

    function applyWholeLayerTextScale(layer, highlight) {
        if (!highlight.enabled || highlight.scale <= 100) {
            return false;
        }
        var animator = null;
        try {
            var textProps = layer.property("ADBE Text Properties");
            var animators = textProps.property("ADBE Text Animators");
            animator = animators.addProperty("ADBE Text Animator");
            animator.name = "Active Word Scale";
            var animatorProps = animator.property("ADBE Text Animator Properties");
            var scale = animatorProps.addProperty("ADBE Text Scale 3D");
            scale.setValue([100, 100, 100]);
            addScaleEnvelope(scale, layer, layer.inPoint, layer.outPoint, highlight.scale);
            setBezierKeys(scale);
            return true;
        } catch (error) {
            removeProperty(animator);
            return false;
        }
    }

    function addMultiLayerCaptions(comp, captions, displayMode, style, highlight) {
        var count = 0;
        highlight = normalizedHighlight(highlight);
        for (var i = 0; i < captions.length; i += 1) {
            var caption = captions[i];
            var text = displayText(caption, displayMode);
            if (!text) {
                continue;
            }
            var layer = comp.layers.addText(text);
            layer.name = "AI Subtitle " + ("000" + (i + 1)).slice(-3);
            layer.inPoint = Math.max(0, Number(caption.start) || 0);
            layer.outPoint = Math.max(layer.inPoint + 0.04, Number(caption.end) || (layer.inPoint + 2));
            var words = validCaptionWords(caption);
            if (highlight.enabled && words.length === 1) {
                applyTextStyle(layer, text, fillStyle(style, highlight.color), comp);
                applyWholeLayerTextScale(layer, highlight);
            } else {
                applyTextStyle(layer, text, style, comp);
                if (highlight.enabled && words.length > 1) {
                    applyWordHighlight(layer, caption, highlight);
                }
            }
            count += 1;
        }
        return count;
    }

    function addSingleLayerCaptions(comp, captions, displayMode, style) {
        if (!captions.length) {
            return 0;
        }
        var firstText = displayText(captions[0], displayMode);
        var layer = comp.layers.addText(firstText);
        layer.name = "AI Subtitle Single";
        setLayerPosition(layer, style, comp);
        if (style.shadow) {
            applyShadow(layer);
        }
        var textProp = getSourceText(layer);
        var start = Number(captions[0].start) || 0;
        var end = Number(captions[captions.length - 1].end) || comp.duration;
        layer.inPoint = Math.max(0, start);
        layer.outPoint = Math.max(layer.inPoint + 0.04, end);

        for (var i = 0; i < captions.length; i += 1) {
            var caption = captions[i];
            var captionStart = Math.max(0, Number(caption.start) || 0);
            var captionEnd = Math.max(captionStart + 0.04, Number(caption.end) || (captionStart + 2));
            textProp.setValueAtTime(captionStart, makeTextDocument(displayText(caption, displayMode), style));
            if (i === captions.length - 1 || Number(captions[i + 1].start) > captionEnd + 0.001) {
                textProp.setValueAtTime(captionEnd, makeTextDocument("", style));
            }
        }
        return captions.length;
    }

    AESubtitleAI.readTextLayers = function () {
        try {
            var comp = activeComp();
            var captions = [];
            for (var i = 1; i <= comp.numLayers; i += 1) {
                var layer = comp.layer(i);
                var textProp = getSourceText(layer);
                if (!textProp) {
                    continue;
                }

                if (textProp.numKeys && textProp.numKeys > 1) {
                    for (var k = 1; k <= textProp.numKeys; k += 1) {
                        var keyText = textFromDocument(textProp.keyValue(k));
                        if (!keyText) {
                            continue;
                        }
                        var keyStart = Math.max(layer.inPoint, textProp.keyTime(k));
                        var keyEnd = k < textProp.numKeys ? textProp.keyTime(k + 1) : layer.outPoint;
                        keyEnd = Math.min(layer.outPoint, keyEnd);
                        if (keyEnd > keyStart) {
                            captions.push({
                                id: "ae-" + i + "-" + k,
                                start: keyStart,
                                end: keyEnd,
                                text: keyText,
                                translation: ""
                            });
                        }
                    }
                } else {
                    var text = textFromDocument(textProp.value);
                    if (text) {
                        captions.push({
                            id: "ae-" + i,
                            start: layer.inPoint,
                            end: layer.outPoint,
                            text: text,
                            translation: ""
                        });
                    }
                }
            }
            captions.sort(function (a, b) {
                return a.start - b.start;
            });
            return ok(captions);
        } catch (error) {
            return fail(error);
        }
    };

    AESubtitleAI.importCaptions = function (jsonText) {
        try {
            var payload = parseJSON(jsonText);
            var comp = activeComp();
            var captions = payload.captions || [];
            var style = payload.style || {};
            var displayMode = payload.displayMode || "source";
            var mode = payload.mode || "multi";
            var highlight = normalizedHighlight(payload.wordHighlight);
            var count = 0;

            app.beginUndoGroup("AI Subtitle Import");
            if (mode === "single") {
                count = addSingleLayerCaptions(comp, captions, displayMode, style);
            } else {
                count = addMultiLayerCaptions(comp, captions, displayMode, style, highlight);
            }
            app.endUndoGroup();
            return ok({ count: count });
        } catch (error) {
            try {
                app.endUndoGroup();
            } catch (undoError) {}
            return fail(error);
        }
    };
})();
