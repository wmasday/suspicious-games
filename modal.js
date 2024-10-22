const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const openModalBtn = document.querySelector('.btn-open');
const closeModalBtn = document.querySelector('.btn-close');

const openModalAddCodeBtn = document.querySelector('.btn-addCode');
const closeModalAddCodeBtn = document.querySelector('.btn-closeAddCode');
const modalAddCode = document.querySelector('.modalAddCode');

const openModal = (e) => {
    e.preventDefault();
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

const openModalAddCode = (e) => {
    e.preventDefault();
    modalAddCode.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

const closeModal = (e) => {
    e.preventDefault();
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
}

const closeAddCode = (e) => {
    e.preventDefault();
    modalAddCode.classList.add('hidden');
    overlay.classList.add('hidden');
}

openModalAddCodeBtn.addEventListener('click', openModalAddCode);
closeModalAddCodeBtn.addEventListener('click', closeAddCode);
openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);