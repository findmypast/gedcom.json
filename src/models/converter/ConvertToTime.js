import ConvertTo from './ConvertTo.js';

export default class ConvertToTime extends ConvertTo {
  constructor(hasTime) {
    super('Time');
    this.HasTime = hasTime ?? 'HasTime';
  }
}
