(function (global) {
    "use strict";

    function cloneCaption(caption) {
        return {
            id: caption.id || makeId(),
            start: Number(caption.start) || 0,
            end: Number(caption.end) || 0,
            text: caption.text || "",
            translation: caption.translation || ""
        };
    }

    function makeId() {
        return "cap-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    }

    function normalizeText(text) {
        return String(text || "")
            .replace(/\r/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+/g, "\n")
            .replace(/[ \t]{2,}/g, " ")
            .replace(/([，。！？；：、,.!?;:])\1+/g, "$1")
            .replace(/\s+([，。！？；：、])/g, "$1")
            .replace(/([（《“])\s+/g, "$1")
            .replace(/\s+([）》”])/g, "$1")
            .replace(/([A-Za-z0-9])([，。！？；：])/g, "$1$2")
            .replace(/([，。！？；：])([A-Za-z0-9])/g, "$1 $2")
            .trim();
    }

    function visibleLength(text) {
        return String(text || "").replace(/\s/g, "").length;
    }

    function splitLongPiece(piece, maxChars) {
        var output = [];
        var source = piece.trim();
        while (visibleLength(source) > maxChars) {
            var cut = findSoftCut(source, maxChars);
            output.push(source.slice(0, cut).trim());
            source = source.slice(cut).trim();
        }
        if (source) {
            output.push(source);
        }
        return output;
    }

    function findSoftCut(text, maxChars) {
        var count = 0;
        var lastSpace = -1;
        var lastComma = -1;
        for (var i = 0; i < text.length; i += 1) {
            if (!/\s/.test(text.charAt(i))) {
                count += 1;
            }
            if (/\s/.test(text.charAt(i))) {
                lastSpace = i + 1;
            }
            if (/[，,、]/.test(text.charAt(i))) {
                lastComma = i + 1;
            }
            if (count >= maxChars) {
                if (lastComma > 0) {
                    return lastComma;
                }
                if (lastSpace > 0) {
                    return lastSpace;
                }
                return i + 1;
            }
        }
        return text.length;
    }

    function splitText(text, maxChars) {
        maxChars = Math.max(8, Number(maxChars) || 24);
        var normalized = normalizeText(text);
        if (!normalized) {
            return [];
        }

        var parts = [];
        var buffer = "";
        for (var i = 0; i < normalized.length; i += 1) {
            var ch = normalized.charAt(i);
            buffer += ch;
            if (/[。！？!?；;]/.test(ch) || visibleLength(buffer) >= maxChars) {
                parts = parts.concat(splitLongPiece(buffer, maxChars));
                buffer = "";
            }
        }
        if (buffer.trim()) {
            parts = parts.concat(splitLongPiece(buffer, maxChars));
        }

        return parts.filter(Boolean);
    }

    function splitCaption(caption, maxChars) {
        var clean = cloneCaption(caption);
        clean.text = normalizeText(clean.text);
        clean.translation = normalizeText(clean.translation);
        var textParts = splitText(clean.text, maxChars);
        if (textParts.length <= 1) {
            return [clean];
        }

        var translationParts = clean.translation ? splitText(clean.translation, Math.round(maxChars * 1.35)) : [];
        var duration = Math.max(0.04, clean.end - clean.start);
        var totalWeight = textParts.reduce(function (sum, part) {
            return sum + Math.max(1, visibleLength(part));
        }, 0);
        var cursor = clean.start;

        return textParts.map(function (part, index) {
            var weight = Math.max(1, visibleLength(part));
            var pieceDuration = index === textParts.length - 1 ? clean.end - cursor : duration * weight / totalWeight;
            var next = index === textParts.length - 1 ? clean.end : Math.min(clean.end, cursor + pieceDuration);
            var row = {
                id: makeId(),
                start: cursor,
                end: Math.max(cursor + 0.04, next),
                text: part,
                translation: translationParts[index] || ""
            };
            cursor = row.end;
            return row;
        });
    }

    function cleanCaptions(captions) {
        return (captions || []).map(function (caption) {
            var row = cloneCaption(caption);
            row.text = normalizeText(row.text);
            row.translation = normalizeText(row.translation);
            if (row.end <= row.start) {
                row.end = row.start + 1.5;
            }
            return row;
        }).filter(function (caption) {
            return caption.text || caption.translation;
        }).sort(function (a, b) {
            return a.start - b.start;
        });
    }

    function segment(captions, options) {
        options = options || {};
        var maxChars = Number(options.maxChars) || 24;
        var output = [];
        cleanCaptions(captions).forEach(function (caption) {
            output = output.concat(splitCaption(caption, maxChars));
        });
        return output;
    }

    function optimize(captions, options, onLog) {
        options = options || {};
        var optimized = segment(captions, options);
        if (!options.translate) {
            return Promise.resolve(optimized);
        }
        if (!global.LocalServices || typeof global.LocalServices.translateOffline !== "function") {
            if (onLog) {
                onLog("离线翻译模块未载入，已完成断句和清理。");
            }
            return Promise.resolve(optimized);
        }

        var texts = optimized.map(function (caption) {
            return caption.text;
        });

        return global.LocalServices.translateOffline(texts, options, onLog).then(function (translations) {
            translations.forEach(function (translation, index) {
                if (translation) {
                    optimized[index].translation = normalizeText(translation);
                }
            });
            return optimized;
        }).catch(function (error) {
            if (onLog) {
                onLog("离线翻译未完成：" + (error && error.message ? error.message : error));
            }
            return optimized;
        });
    }

    global.LocalOptimizer = {
        cleanCaptions: cleanCaptions,
        segment: segment,
        optimize: optimize,
        normalizeText: normalizeText,
        makeId: makeId
    };
})(window);
