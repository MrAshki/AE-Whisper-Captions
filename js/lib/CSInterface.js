(function (global) {
    "use strict";

    if (global.CSInterface) {
        return;
    }

    var SystemPath = {
        USER_DATA: "userData",
        COMMON_FILES: "commonFiles",
        MY_DOCUMENTS: "myDocuments",
        APPLICATION: "application",
        EXTENSION: "extension",
        HOST_APPLICATION: "hostApplication"
    };

    function CSInterface() {}

    CSInterface.prototype.evalScript = function (script, callback) {
        if (global.__adobe_cep__ && typeof global.__adobe_cep__.evalScript === "function") {
            global.__adobe_cep__.evalScript(script, callback || function () {});
            return;
        }

        if (typeof callback === "function") {
            callback(JSON.stringify({
                ok: false,
                error: "未在 Adobe CEP 环境中运行"
            }));
        }
    };

    CSInterface.prototype.getSystemPath = function (pathType) {
        if (global.__adobe_cep__ && typeof global.__adobe_cep__.getSystemPath === "function") {
            return global.__adobe_cep__.getSystemPath(pathType);
        }

        if (pathType === SystemPath.EXTENSION) {
            var path = decodeURI(global.location.pathname);
            if (/^\/[A-Za-z]:\//.test(path)) {
                path = path.slice(1);
            }
            return path.replace(/\/[^\/]*$/, "");
        }

        return "";
    };

    CSInterface.prototype.openURLInDefaultBrowser = function (url) {
        if (global.__adobe_cep__ && typeof global.__adobe_cep__.openURLInDefaultBrowser === "function") {
            global.__adobe_cep__.openURLInDefaultBrowser(url);
        } else {
            global.open(url, "_blank");
        }
    };

    global.CSInterface = CSInterface;
    global.SystemPath = SystemPath;
})(window);
