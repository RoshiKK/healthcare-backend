export default class ApiResponse<T> {
  constructor(
    public statusCode: number,
    public data: T,
    public message: string = 'Success'
  ) {}

  static success<T>(data: T, message: string = 'Success') {
    return new ApiResponse(200, data, message);
  }

  static created<T>(data: T, message: string = 'Created') {
    return new ApiResponse(201, data, message);
  }

  static noContent(message: string = 'No Content') {
    return new ApiResponse(204, null, message);
  }

  toJSON() {
    return {
      success: true,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data
    };
  }
}