export interface IApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
    timestamp: string;
}

export interface IApiError {
    statusCode: number; 
    message: string;
}
