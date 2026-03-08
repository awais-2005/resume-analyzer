import { IApiResponse } from "../types/Api"

export class ApiResponse<T> implements IApiResponse<T> {
    public timestamp: string;
    constructor(
        public success: boolean,
        public data: T,
        public message: string,
    ) {
        this.timestamp = new Date().toISOString();
    }
}