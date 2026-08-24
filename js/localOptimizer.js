(function (global) {
    "use strict";

    function cloneCaption(caption) {
        return {
            id: caption.id || makeId(),
            start: Number(caption.start) || 0,
            end: Number(caption.end) || 0,
            text: caption.text || "",
            translation: caption.translation || "",
            words: cloneWords(caption.words)
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

    function unicodeLength(text) {
        return Array.from(String(text || "").replace(/\s/g, "")).length;
    }

    function cloneWords(words) {
        return normalizeWords(words);
    }

    function normalizeWord(word, previousWord) {
        var text = normalizeText(word && word.text);
        var start = Number(word && word.start);
        var end = Number(word && word.end);
        if (!text || !isFinite(start) || start < 0) {
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

    function normalizeWords(words) {
        var output = [];
        (words || []).forEach(function (word) {
            var normalized = normalizeWord(word, output[output.length - 1]);
            if (normalized) {
                output.push(normalized);
            }
        });
        return output;
    }

    function flattenCaptionWords(captions) {
        var words = [];
        (captions || []).forEach(function (caption) {
            if (caption && caption.words && caption.words.length) {
                words = words.concat(caption.words);
            }
        });
        return normalizeWords(words);
    }

    function groupingSettings(options) {
        options = options || {};
        return {
            maxWords: Math.max(1, Math.min(10, Number(options.maxWords) || 4)),
            maxChars: Math.max(1, Number(options.groupMaxChars) || Number(options.maxChars) || 28),
            pauseSplit: Math.max(0, Number(options.pauseSplit) || 0.35),
            maxDuration: Math.max(0.1, Number(options.maxDuration) || 2.5),
            minDuration: Math.max(0, Number(options.minDuration) || 0.4)
        };
    }

    function groupDuration(group) {
        if (!group.length) {
            return 0;
        }
        return Math.max(0, group[group.length - 1].end - group[0].start);
    }

    function groupText(group) {
        return normalizeText(group.map(function (word) {
            return word.text;
        }).join(" "));
    }

    function groupCharCount(group) {
        return unicodeLength(groupText(group));
    }

    function hasPhraseBoundary(text) {
        return /[.!?;:،؛؟。！？；：]["')\]}»”]*$/.test(String(text || "").trim());
    }

    function shouldSplitBeforeNext(group, nextWord, settings) {
        if (!group.length || !nextWord) {
            return false;
        }
        var last = group[group.length - 1];
        var withNext = group.concat([nextWord]);
        var pause = Math.max(0, nextWord.start - last.end);
        var hardLimit = group.length >= settings.maxWords ||
            groupCharCount(withNext) > settings.maxChars ||
            groupDuration(withNext) > settings.maxDuration;
        var naturalLimit = pause >= settings.pauseSplit || hasPhraseBoundary(last.text);
        if (hardLimit) {
            return group.length >= settings.maxWords || groupDuration(group) >= settings.minDuration;
        }
        return naturalLimit && groupDuration(group) >= settings.minDuration;
    }

    function mergeTinyGroups(groups, settings) {
        var output = [];
        groups.forEach(function (group) {
            if (!group.length) {
                return;
            }
            var duration = groupDuration(group);
            var previous = output[output.length - 1];
            if (previous && group.length === 1 && duration < settings.minDuration) {
                var pause = Math.max(0, group[0].start - previous[previous.length - 1].end);
                if (pause < settings.pauseSplit &&
                        previous.length + group.length <= settings.maxWords &&
                        groupCharCount(previous.concat(group)) <= settings.maxChars) {
                    output[output.length - 1] = previous.concat(group);
                    return;
                }
            }
            output.push(group);
        });

        for (var i = 0; i < output.length - 1; i += 1) {
            var current = output[i];
            var next = output[i + 1];
            if (current.length === 1 && groupDuration(current) < settings.minDuration) {
                var nextPause = Math.max(0, next[0].start - current[current.length - 1].end);
                if (nextPause < settings.pauseSplit &&
                        current.length + next.length <= settings.maxWords &&
                        groupCharCount(current.concat(next)) <= settings.maxChars) {
                    output[i + 1] = current.concat(next);
                    output.splice(i, 1);
                    i -= 1;
                }
            }
        }
        return output;
    }

    function captionFromWords(words) {
        var cleanWords = normalizeWords(words);
        return {
            id: makeId(),
            start: cleanWords[0].start,
            end: Math.max(cleanWords[0].start + 0.04, cleanWords[cleanWords.length - 1].end),
            text: groupText(cleanWords),
            translation: "",
            words: cleanWords
        };
    }

    function groupWords(words, options) {
        var sourceWords = normalizeWords(words);
        var settings = groupingSettings(options);
        var groups = [];
        var current = [];
        sourceWords.forEach(function (word) {
            if (shouldSplitBeforeNext(current, word, settings)) {
                groups.push(current);
                current = [];
            }
            current.push(word);
        });
        if (current.length) {
            groups.push(current);
        }
        return mergeTinyGroups(groups, settings).filter(function (group) {
            return group.length;
        }).map(captionFromWords);
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

    function segment(captions, options, sourceWords) {
        options = options || {};
        if (sourceWords && sourceWords.length) {
            return groupWords(sourceWords, options);
        }
        var captionWords = flattenCaptionWords(captions);
        if (captionWords.length) {
            return groupWords(captionWords, options);
        }
        var maxChars = Number(options.maxChars) || 24;
        var output = [];
        cleanCaptions(captions).forEach(function (caption) {
            output = output.concat(splitCaption(caption, maxChars));
        });
        return output;
    }

    function optimize(captions, options, onLog, sourceWords) {
        options = options || {};
        var optimized = segment(captions, options, sourceWords);
        if (!options.translate) {
            return Promise.resolve(optimized);
        }
        if (!global.LocalServices || typeof global.LocalServices.translateOffline !== "function") {
            if (onLog) {
                onLog("Offline translation module is not loaded. Segmentation and cleanup are complete.");
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
                onLog("Offline translation did not complete: " + (error && error.message ? error.message : error));
            }
            return optimized;
        });
    }

    global.LocalOptimizer = {
        cleanCaptions: cleanCaptions,
        groupWords: groupWords,
        normalizeWords: normalizeWords,
        segment: segment,
        optimize: optimize,
        normalizeText: normalizeText,
        makeId: makeId
    };
})(window);
