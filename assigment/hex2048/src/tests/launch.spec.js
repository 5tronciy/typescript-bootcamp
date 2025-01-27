require("expect-puppeteer")
const path = require("path")

const { getFieldPoints } = require("../fieldUtils")
const { Server } = require("../rngServer")
const { readDOMField, getDataStatus } = require("./utils")

let server
let radius

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const urlArg = process.argv.filter((x) => x.startsWith("--url="))[0]
const baseUrl = (urlArg && urlArg.replace("--url=", "")) || "http://localhost:8080/"
const url = path.join(baseUrl, '#test')

describe("Hex game launch", () => {
  beforeAll(async () => {
    server = new Server(true)
    await server.start()
  })

  afterAll(async () => {
    await server.end()
  })

  describe("radius 2", () => {
    radius = 2

    it("should render correct field with data-x, data-y, data-z, data-value with 0", async () => {
      const handler = jest.fn(() => [])
      const expected = getFieldPoints(radius).map(c => ({ ...c, value: 0 }))

      server.changeHandler(handler)

      await page.goto(url + radius)
      await delay(300)

      const field = await readDOMField(page, radius)

      expect(field).toEqual(expect.arrayContaining(expected))
    })

    it("should send first request automatically after game loaded", async () => {
      const cells = [{ x: 0, y: 0, z: 0, value: 8 }]
      const handler = jest.fn(() => cells)
      server.changeHandler(handler)

      await page.goto(url + radius)
      await delay(300)

      expect(handler).toBeCalled()
    })

    describe("moves", () => {
      it.each([
        ["north", "KeyW", { x: 0, y: 1, z: -1 }],
        ["north-west", "KeyQ", { x: -1, y: 1, z: 0 }],
        ["north-east", "KeyE", { x: 1, y: 0, z: -1 }],
        ["south", "KeyS", { x: 0, y: -1, z: 1 }],
        ["south-west", "KeyA", { x: -1, y: 0, z: 1 }],
        ["south-east", "KeyD", { x: 1, y: -1, z: 0 }],
      ])("should move to %s after press %s", async (_, keyCode, expected) => {
        const cells = [{ x: 0, y: 0, z: 0, value: 128 }]

        server.changeHandler((_, field) => (field.length === 0 ? cells : []))

        await page.goto(url + radius)
        await delay(300)
        await page.keyboard.press(keyCode)
        await delay(300)

        const field = await readDOMField(page, radius)

        expect(field.filter(({ value }) => value === 128)).toEqual(
          expect.arrayContaining([{ ...expected, value: 128 }]),
        )
      })

      it("should not do anything if there are not movements done", async () => {
        const cells = [{ x: 0, y: 1, z: -1, value: 2 }]
        server.changeHandler(() => cells)
        
        await page.goto(url + radius)
        await delay(300)

        const handler = jest.fn()
        server.changeHandler(handler)

        await page.keyboard.press("KeyW")
        await delay(300)

        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe("adding", () => {
      it.each([
        [
          "should add 2 cells with same value",
          "KeyW",
          [
            { x: 0, y: 0, z: 0, value: 2 },
            { x: 0, y: 1, z: -1, value: 2 },
          ],
          [{ x: 0, y: 1, z: -1, value: 4 }],
        ],
        [
          "should move 3 cells and add 2 cells",
          "KeyW",
          [
            { x: 0, y: 1, z: -1, value: 2 },
            { x: 0, y: 0, z: 0, value: 2 },
            { x: 0, y: -1, z: 1, value: 2 },
          ],
          [
            { x: 0, y: 1, z: -1, value: 4 },
            { x: 0, y: 0, z: 0, value: 2 },
          ],
        ],
      ])("%s", async (_message, keyCode, startPosition, expected) => {
        server.changeHandler((_, field) => (field.length === 0 ? startPosition : []))

        await page.goto(url + radius)
        await delay(300)
        await page.keyboard.press(keyCode)
        await delay(300)

        const field = await readDOMField(page, radius)

        expect(field.filter(({ value }) => value > 0)).toEqual(expect.arrayContaining(expected))
      })
    })

    describe("status", () => {
      it('should show status "playing" if game isn\'t over', async () => {
        const cells = []
        const handler = jest.fn(() => cells)
        server.changeHandler(handler)

        await page.goto(url + radius)
        await delay(300)

        const statusElement = await page.waitForSelector("[data-status]")
        const status = await getDataStatus(statusElement)

        expect(status).toBe("playing")
      })

      it('should show status "game-over" if game is over', async () => {
        const cells = [
          { x: -1, y: 1, z: 0, value: 64 },
          { x: -1, y: 0, z: 1, value: 16 },
          { x: 0, y: 1, z: -1, value: 16 },
          { x: 0, y: 0, z: 0, value: 32 },
          { x: 0, y: -1, z: 1, value: 2 },
          { x: 1, y: 0, z: -1, value: 4 },
          { x: 1, y: -1, z: 0, value: 8 },
        ]
        const handler = jest.fn(() => cells)
        server.changeHandler(handler)

        await page.goto(url + radius)
        await delay(300)

        const statusElement = await page.waitForSelector("[data-status]")
        await page.keyboard.press("KeyA")
        const status = await getDataStatus(statusElement)

        expect(status).toBe("game-over")
      })
    })
  })
})
