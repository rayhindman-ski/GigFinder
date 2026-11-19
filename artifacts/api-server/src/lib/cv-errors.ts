export class CvError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CvError";
  }
}
