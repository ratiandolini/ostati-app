process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";
process.env.GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP || "false";
process.env.DISABLE_ESLINT_PLUGIN =
  process.env.DISABLE_ESLINT_PLUGIN || "true";

const Module = require("module");
const originalLoad = Module._load;

class NoopForkTsCheckerPlugin {
  apply() {}
}

Module._load = function patchedLoad(request, parent, isMain) {
  if (
    request === "react-dev-utils/ForkTsCheckerWebpackPlugin" ||
    request === "react-dev-utils/ForkTsCheckerWarningWebpackPlugin"
  ) {
    return NoopForkTsCheckerPlugin;
  }

  return originalLoad.call(this, request, parent, isMain);
};

require("react-scripts/scripts/build");
