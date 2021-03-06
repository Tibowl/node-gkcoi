import {
  generateDarkFleetCanvasAsync,
  generateDarkAirbaseCanvasAsync,
  generateDarkParameterCanvasAsync,
} from "./theme/dark";
import { parse, Ship, DeckBuilder, Speed, LoS, MasterData } from "./type";
import { getLoSValue, fetchStart2, MASTER_URL } from "./utils";
import { generate74eoLargeCardFleetCanvasAsync } from "./theme/74eoLC";
import { generate74eoMediumCutinFleetCanvasAsync } from "./theme/74eoMC";
import { generate74eoSmallBannerFleetCanvasAsync } from "./theme/74eoSB";
import { Canvas, createCanvas2D, setCacheDir } from "./canvas";
import { stick } from "./stick";

export {
  DeckBuilder,
  DeckBuilderFleet,
  DeckBuilderShip,
  DeckBuilderItem,
  DeckBuilderAirbase,
} from "./type";

export function configure(options: { cacheDir?: string }): void {
  if (options.cacheDir) setCacheDir(options.cacheDir);
}

/**
 * 画像を生成する
 * @param deckbuilder フォーマット
 * @param options 画像取得オプション
 */
export async function generate(
  deckbuilder: DeckBuilder,
  options: {
    start2URL?: string;
    shipURL?: string;
    start2Data?: MasterData;
  } = {}
): Promise<Canvas> {
  const start2: MasterData =
    options.start2Data ||
    (await fetchStart2(options.start2URL || `${MASTER_URL}/START2.json`));
  const { lang, theme, hqlv, fleets, airbases, airState, comment } = parse(
    deckbuilder,
    start2,
    options.shipURL || `${MASTER_URL}/ship`
  );
  const has5slot = fleets.some(({ ships }) =>
    ships.some((ship) => ship.slotNum === 5)
  );
  const fimage = stick(
    await Promise.all(
      fleets.map(
        async ({ ships, name }: { ships: Ship[]; name: string }, i) => {
          const los: LoS = {
            1: getLoSValue(ships, hqlv, 1),
            2: getLoSValue(ships, hqlv, 2),
            3: getLoSValue(ships, hqlv, 3),
            4: getLoSValue(ships, hqlv, 4),
            5: getLoSValue(ships, hqlv, 5),
          };
          const airPower = ships
            .filter((ship) => ship.id > 0)
            .map((ship) => ship.airPower)
            .reduce(
              (previous, airpower) => {
                previous.min += airpower.min;
                previous.max += airpower.max;
                return previous;
              },
              {
                min: 0,
                max: 0,
              }
            );
          const speed: Speed = ships
            .filter((ship) => ship.id > 0)
            .map((ship) => ship.speed)
            .reduce(
              (previous, speed) => (previous > speed ? speed : previous),
              20
            );

          switch (theme) {
            case "dark":
              return await generateDarkFleetCanvasAsync(
                i,
                ships,
                los,
                airPower,
                speed,
                lang
              );
            case "74lc":
              return await generate74eoLargeCardFleetCanvasAsync(
                name,
                ships,
                los,
                airPower,
                lang
              );
            case "74mc":
              return await generate74eoMediumCutinFleetCanvasAsync(
                name,
                ships,
                los,
                airPower,
                lang,
                has5slot
              );
            case "74sb":
              return await generate74eoSmallBannerFleetCanvasAsync(
                name,
                ships,
                los,
                airPower,
                lang,
                has5slot
              );
          }
        }
      )
    ),
    ["74lc", "74sb"].includes(theme) ||
      fleets.filter(({ ships }) => ships.length > 0).length > 2
      ? 2
      : 1,
    theme === "dark" ? "#212121" : "white"
  );
  const useAirbase = airbases
    .map(({ items }) => items)
    .some((items) => items.some(({ id }) => id > 0));
  if (theme === "dark") {
    const pimage = await generateDarkParameterCanvasAsync(
      fleets
        .slice(0, 2)
        .map((f) => f.ships)
        .flat(),
      airState,
      comment,
      lang
    );

    const { canvas, ctx } = createCanvas2D(
      fimage.width +
        pimage.width +
        2 +
        (fleets.length === 1 && useAirbase ? pimage.width + 2 : 0),
      fimage.height
    );

    ctx.fillStyle = "#212121";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(fimage, 0, 0);

    ctx.drawImage(
      pimage,
      fimage.width +
        2 +
        (fleets.length === 1 && useAirbase ? pimage.width + 2 : 0),
      fleets.length === 1 ? 0 : pimage.height
    );

    if (useAirbase) {
      const aimage = await generateDarkAirbaseCanvasAsync(airbases, lang);
      ctx.drawImage(aimage, fimage.width + 2, 0);
    }
    return canvas;
  }
  return fimage;
}
