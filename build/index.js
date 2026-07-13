"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
let server = null;
const PORT = config_1.config.PORT;
server = app_1.app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
