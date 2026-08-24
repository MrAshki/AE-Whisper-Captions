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

    function addMultiLayerCaptions(comp, captions, displayMode, style) {
        var count = 0;
        for (var i = 0; i < captions.length; i += 1) {
            var caption = captions[i];
            var text = displayText(caption, displayMode);
            if (!text) {
                continue;
            }
            var layer = comp.layers.addText(text);
            layer.name = "AI Subtitle " + ("000" + (i + 1)).slice(-3);
            applyTextStyle(layer, text, style, comp);
            layer.inPoint = Math.max(0, Number(caption.start) || 0);
            layer.outPoint = Math.max(layer.inPoint + 0.04, Number(caption.end) || (layer.inPoint + 2));
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
            var count = 0;

            app.beginUndoGroup("AI Subtitle Import");
            if (mode === "single") {
                count = addSingleLayerCaptions(comp, captions, displayMode, style);
            } else {
                count = addMultiLayerCaptions(comp, captions, displayMode, style);
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
