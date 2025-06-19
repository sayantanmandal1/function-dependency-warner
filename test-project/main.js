function calculateTotal(amount) {
    return amount + calculateTax(amount);
}

function calculateTax(amount) {
    return amount * getTaxRate();
}

function getTaxRate() {
    return 0.1; // 10% tax rate
}

// Example usage
console.log(calculateTotal(100));
