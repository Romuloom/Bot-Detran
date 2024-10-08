import axios, { AxiosRequestConfig } from "axios";

export async function httpRequest(options: AxiosRequestConfig): Promise<any> {
  try {
    const response = await axios(options);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao fazer a requisição: ${error}`);
  }
}
