"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareDates = void 0;
const compareDates = (date1, date2, comparison) => {
    // Ensure both inputs are date objects
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        throw new Error('Invalid date formate. Enure th input are valid dates.');
    }
    switch (comparison) {
        case 'before':
            return d1 < d2; //Return true if date1 is before date2 
        case 'after':
            return d1 > d2; //Return true if date1 is after date2
        case 'equal':
            return d1.getTime() === d2.getTime(); //Return true if both dates are equals
        default:
            throw new Error('Invalid comaprison type. Use "before", "after", or "equal".');
    }
};
exports.compareDates = compareDates;
