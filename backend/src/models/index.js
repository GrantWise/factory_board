/**
 * Models Index
 * ============
 * 
 * Centralized export for all model classes.
 * This simplifies imports and provides a single point of truth for model dependencies.
 */

const AuditLog = require('./AuditLog');
const CharacteristicTypes = require('./CharacteristicTypes');
const ERPConnection = require('./ERPConnection');
const ERPImportLog = require('./ERPImportLog');
const ERPOrderLink = require('./ERPOrderLink');
const ERPSyncState = require('./ERPSyncState');
const JobCharacteristic = require('./JobCharacteristic');
const ManufacturingOrder = require('./ManufacturingOrder');
const ManufacturingStep = require('./ManufacturingStep');
const User = require('./User');
const UserSettings = require('./UserSettings');
const WorkCentre = require('./WorkCentre');
const ApiKey = require('./apiKey');

module.exports = {
  AuditLog,
  CharacteristicTypes,
  ERPConnection,
  ERPImportLog,
  ERPOrderLink,
  ERPSyncState,
  JobCharacteristic,
  ManufacturingOrder,
  ManufacturingStep,
  User,
  UserSettings,
  WorkCentre,
  ApiKey
};