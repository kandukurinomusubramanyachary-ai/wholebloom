const squat = require('./squat');
const wallPushup = require('./wallPushup');
const sideLegRaise = require('./sideLegRaise');

const EXERCISES = Object.freeze([squat, wallPushup, sideLegRaise]);

function exerciseById(id) {
  return EXERCISES.find((exercise) => exercise.id === id) || squat;
}

module.exports = { EXERCISES, exerciseById, sideLegRaise, squat, wallPushup };
