"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const validateRequest = (schema) => (req, _res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next(); // Proceed to the next middleware or route handler
    }
    catch (err) {
        next(err);
    }
};
exports.validateRequest = validateRequest;
