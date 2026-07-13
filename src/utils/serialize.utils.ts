export const serializeDates = (obj: any): any => {
  if (!obj) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeDates(item));
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      result[key] = serializeDates(obj[key]);
    }
    return result;
  }
  
  return obj;
};