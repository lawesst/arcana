const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ["@arcana/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};
