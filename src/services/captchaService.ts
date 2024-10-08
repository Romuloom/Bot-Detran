import { sleep } from "../util/utils";
import { httpRequest } from "./httpClient";

const API_KEY = process.env.API_KEY;

export async function resolveCaptchaV2(
  googleKey: string,
  pageUrl: string
): Promise<string | null> {
  if (!API_KEY) {
    throw new Error("API_KEY não está definida. Verifique o arquivo .env.");
  }

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const unparsedCaptchaId = await httpRequest({
        method: "GET",
        url: `https://2captcha.com/in.php?key=${API_KEY}&method=userrecaptcha&googlekey=${googleKey}&pageurl=${pageUrl}&json=true`,
      });

      console.log("Resposta da solicitação de CAPTCHA:", unparsedCaptchaId);

      const parsedCaptchaId =
        typeof unparsedCaptchaId === "string"
          ? JSON.parse(unparsedCaptchaId)
          : unparsedCaptchaId;

      if (parsedCaptchaId.status !== 1) {
        console.error("Erro ao solicitar o CAPTCHA:", parsedCaptchaId);
        return null;
      }

      const captchaId = parsedCaptchaId.request;
      console.log("Solicitação de CAPTCHA enviada:", parsedCaptchaId);

      while (true) {
        await sleep(15);
        console.log("Verificando se o CAPTCHA está pronto...");
        const captchaReady = await httpRequest({
          method: "GET",
          url: `https://2captcha.com/res.php?key=${API_KEY}&action=get&id=${captchaId}&json=true`,
        });

        console.log("Resposta da verificação do CAPTCHA:", captchaReady);

        const parsedCaptchaReady =
          typeof captchaReady === "string"
            ? JSON.parse(captchaReady)
            : captchaReady;

        if (parsedCaptchaReady.status === 1) {
          console.log("CAPTCHA resolvido com sucesso!");
          return parsedCaptchaReady.request;
        } else if (parsedCaptchaReady.request === "ERROR_CAPTCHA_UNSOLVABLE") {
          console.log(
            "Erro de CAPTCHA não solucionável. Tentando novamente..."
          );
          break;
        } else if (parsedCaptchaReady.request !== "CAPCHA_NOT_READY") {
          console.error(
            "Erro ao resolver CAPTCHA:",
            parsedCaptchaReady.request
          );
          return null;
        }
      }
    } catch (error) {
      console.error("Erro ao solicitar resolução do CAPTCHA:", error);
    }
  }

  console.error("Falha ao resolver o CAPTCHA após 3 tentativas.");
  return null;
}
