"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachBaseUrlUploads = void 0;
const attachBaseUrlUploads = (data, req) => {
    const driver = process.env.STORAGE_DRIVER;
    const azureBase = process.env.AZURE_STORAGE_URL?.replace(/\/$/, "");
    const container = process.env.AZURE_CONTAINER_NAME;
    const baseUrl = driver === "azure"
        ? `${azureBase}/${container}`
        : `${req.protocol}://${req.get("host")}`;
    const transform = (item) => {
        if (Array.isArray(item)) {
            return item.map(transform);
        }
        if (item && typeof item === "object") {
            const newItem = {};
            for (const key in item) {
                const value = item[key];
                if (key === "url" && typeof value === "string") {
                    if (value.startsWith("http://") || value.startsWith("https://")) {
                        newItem[key] = value;
                    }
                    else if (value.startsWith("/uploads")) {
                        if (driver === "azure") {
                            const cleanPath = value.replace(/^\/uploads\//, "");
                            newItem[key] = `${baseUrl}/${cleanPath}`;
                        }
                        else {
                            newItem[key] = `${baseUrl}${value}`;
                        }
                    }
                    else {
                        newItem[key] = value;
                    }
                }
                else {
                    newItem[key] = transform(value);
                }
            }
            return newItem;
        }
        return item;
    };
    return transform(data);
};
exports.attachBaseUrlUploads = attachBaseUrlUploads;
// export const attachBaseUrlUploads = (obj: any, req: Request) => {
//   const baseUrl = `${req.protocol}://${req.get('host')}`;
//   return JSON.parse(
//     JSON.stringify(obj).replace(
//       /"url":"(\/uploads\/[^"]+)"/g,
//       `"url":"${baseUrl}$1"`
//     )
//   );
// };
