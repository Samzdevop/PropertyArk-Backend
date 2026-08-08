export const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

export const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export const parseDate = (dateString: string): Date => {
  const date = new Date(dateString);
  
  if (!isNaN(date.getTime())) {
    return date;
  }

  const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (simpleDateRegex.test(dateString)) {
    const parts = dateString.split('-').map(Number);
    const parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  throw new Error(`Invalid date format: ${dateString}`);
};


export const formatDateForDB = (date: Date): Date => {
  return new Date(date.setHours(0, 0, 0, 0));
};