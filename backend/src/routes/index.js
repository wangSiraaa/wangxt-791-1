const express = require('express');
const router = express.Router();

const commissionRouter = require('./commission');
const sampleRouter = require('./sample');
const testItemRouter = require('./testItem');
const assignmentRouter = require('./assignment');
const reportRouter = require('./report');
const queryRouter = require('./query');

router.use('/commissions', commissionRouter);
router.use('/samples', sampleRouter);
router.use('/test-items', testItemRouter);
router.use('/assignments', assignmentRouter);
router.use('/reports', reportRouter);
router.use('/query', queryRouter);

module.exports = router;
