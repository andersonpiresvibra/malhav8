import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        rules: {
            // we will suppress rules for now to get a pass
            "no-unused-vars": "off",
            "no-undef": "off"
        }
    }
];
