/**
 * Class with informations about the parsed line
 */
export default class ParsedLine {
  /**
   * @param lineNumber line number
   * @param level level in hierarchy
   * @param tag line tag
   * @param value value = line text without level and tag\reference id
   * @param refId reference id
   */
  constructor(lineNumber, level, tag, value = '', refId = '') {
    this.LineNumber = lineNumber;
    this.Level = level;
    this.Tag = tag;
    this.Value = value;
    this.ReferenceId = refId;
  }

  toGedcomLine() {
    let line = `${this.Level}`;
    if (this.ReferenceId !== '') {
      if (this.Level === 0) {
        line += ` ${this.ReferenceId} ${this.Tag}`;
      } else {
        line += ` ${this.Tag} ${this.ReferenceId}`;
      }
    } else {
      line += ` ${this.Tag}`;
    }
    if (this.Value !== '') {
      line += ` ${this.Value}`;
    }
    return line;
  }
}
