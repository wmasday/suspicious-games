const players = [
    'belligerent_mantis_17 (You)',
    'jeune_ninja_76',
    'voracious_mantis_69',
    'voracious_cupcake_21',
    'jeune_engineer_96',
    'voluble_woodworkers_16',
    'lachrymose_moldmaker_91',
    'garrulous_panel_40',
    'incendiary_animator_92',
    'risible_shop_98',
    'risible_shop_98',
    'risible_shop_98',
    'risible_shop_98',
    'risible_shop_98',
    'risible_shop_98',
];

const playersList = document.getElementById('players-list');

players.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('label-name');
    playerDiv.textContent = player; 
    playersList.appendChild(playerDiv); 
});