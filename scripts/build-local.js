process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";

if (process.env.REACT_APP_AUTH_MODE === "dev_password") {
  console.error(
    "\nRefusing to build for production with REACT_APP_AUTH_MODE=dev_password.\n" +
      "This mode bypasses real phone/OTP verification and must not ship.\n" +
      "Set REACT_APP_AUTH_MODE=email_password (or unset it) before building.\n"
  );
  process.exit(1);
}
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
