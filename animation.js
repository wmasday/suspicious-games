document.addEventListener('DOMContentLoaded', function () {
    const eliminatedText = document.getElementById('eliminated-text');
    const cardUser = document.getElementById('user-card');
    // Delay before the text fades in
    setTimeout(() => {
        eliminatedText.classList.remove('fade-hidden');
        eliminatedText.classList.add('fade-visible');
        cardUser.classList.add('card-hidden');
    }, 1500); 
});