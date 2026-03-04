// Generic helpers.
function shuffleArray(array) {
    const newArray = [...array]; // 深拷贝数组，避免修改原数据
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// experiment.js

// experiment.js
