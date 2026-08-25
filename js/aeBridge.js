(function (global) {
    "use strict";

    var cs = new global.CSInterface();

    function call(name, payload) {
        return new Promise(function (resolve, reject) {
            var expression;
            if (typeof payload === "undefined") {
                expression = "AESubtitleAI." + name + "()";
            } else {
                expression = "AESubtitleAI." + name + "(" + JSON.stringify(JSON.stringify(payload)) + ")";
            }

            cs.evalScript(expression, function (result) {
                var data;
                try {
                    data = JSON.parse(result);
                } catch (error) {
                    reject(new Error(result || "AE returned data that could not be parsed"));
                    return;
                }

                if (data && data.ok) {
                    resolve(data.data);
                } else {
                    reject(new Error((data && data.error) || "AE operation failed"));
                }
            });
        });
    }

    global.AEBridge = {
        listFonts: function () {
            return call("listFonts");
        },
        readTextLayers: function () {
            return call("readTextLayers");
        },
        importCaptions: function (payload) {
            return call("importCaptions", payload);
        }
    };
})(window);
