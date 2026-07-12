(function (global) {
    "use strict";

    function pad(value, size) {
        var text = String(Math.floor(Math.abs(value)));
        while (text.length < size) {
            text = "0" + text;
        }
        return text;
    }

    function parseTimecode(value) {
        if (typeof value !== "string") {
            return 0;
        }
        var match = value.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
        if (!match) {
            return 0;
        }
        var ms = match[4];
        while (ms.length < 3) {
            ms += "0";
        }
        return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(ms.slice(0, 3)) / 1000;
    }

    function formatTimecode(seconds) {
        seconds = Math.max(0, Number(seconds) || 0);
        var totalMs = Math.round(seconds * 1000);
        var ms = totalMs % 1000;
        var totalSeconds = Math.floor(totalMs / 1000);
        var s = totalSeconds % 60;
        var totalMinutes = Math.floor(totalSeconds / 60);
        var m = totalMinutes % 60;
        var h = Math.floor(totalMinutes / 60);
        return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + "," + pad(ms, 3);
    }

    function hasCjk(text) {
        return /[\u3400-\u9fff]/.test(text || "");
    }

    function hasLatin(text) {
        return /[A-Za-z]/.test(text || "");
    }

    function splitBilingualLines(lines, detectBilingual) {
        var clean = lines.map(function (line) {
            return line.trim();
        }).filter(Boolean);

        if (!clean.length) {
            return { text: "", translation: "" };
        }

        if (!detectBilingual || clean.length === 1) {
            return { text: clean.join("\n"), translation: "" };
        }

        if (clean.length === 2) {
            if ((hasCjk(clean[0]) && hasLatin(clean[1])) || (hasLatin(clean[0]) && hasCjk(clean[1]))) {
                return { text: clean[0], translation: clean[1] };
            }
            return { text: clean[0], translation: clean[1] };
        }

        var midpoint = Math.ceil(clean.length / 2);
        return {
            text: clean.slice(0, midpoint).join("\n"),
            translation: clean.slice(midpoint).join("\n")
        };
    }

    function parse(srtText, options) {
        options = options || {};
        var text = String(srtText || "").replace(/\r/g, "").trim();
        if (!text) {
            return [];
        }

        return text.split(/\n{2,}/).map(function (block, index) {
            var lines = block.split("\n").filter(function (line) {
                return line.trim() !== "";
            });
            if (!lines.length) {
                return null;
            }

            if (/^\d+$/.test(lines[0].trim())) {
                lines.shift();
            }

            var timing = lines.shift() || "";
            var timeMatch = timing.match(/(.+?)\s*-->\s*(.+?)(?:\s|$)/);
            if (!timeMatch) {
                return null;
            }

            var body = splitBilingualLines(lines, options.detectBilingual !== false);
            return {
                id: "srt-" + Date.now() + "-" + index,
                start: parseTimecode(timeMatch[1]),
                end: parseTimecode(timeMatch[2]),
                text: body.text,
                translation: body.translation
            };
        }).filter(Boolean).sort(function (a, b) {
            return a.start - b.start;
        });
    }

    function captionText(caption, mode) {
        var source = (caption.text || "").trim();
        var translation = (caption.translation || "").trim();
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

    function serialize(captions, mode) {
        return (captions || []).map(function (caption, index) {
            return [
                String(index + 1),
                formatTimecode(caption.start) + " --> " + formatTimecode(caption.end),
                captionText(caption, mode || "source")
            ].join("\n");
        }).join("\n\n") + "\n";
    }

    function parseEditableTime(value) {
        value = String(value || "").trim();
        if (/^\d+(\.\d+)?$/.test(value)) {
            return Number(value);
        }
        return parseTimecode(value.replace(".", ","));
    }

    global.SRT = {
        parse: parse,
        serialize: serialize,
        captionText: captionText,
        parseTimecode: parseTimecode,
        formatTimecode: formatTimecode,
        parseEditableTime: parseEditableTime
    };
})(window);
