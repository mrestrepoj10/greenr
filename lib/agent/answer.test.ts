import { describe, expect, it } from 'vitest'
import { isComposingCards, parseAnswer } from './answer'

const spec = {
  root: 'a',
  elements: {
    a: { type: 'note', props: { text: 'South has the highest WWR.' }, children: ['b', 'c'] },
    b: { type: 'stat', props: { code: 'EEM01', input: 'Overall window-to-wall ratio' } },
    c: { type: 'orientation_table', props: { highlight: ['S'] } },
  },
}

describe('parseAnswer', () => {
  it('splits the lead prose from a valid card block', () => {
    const answer = parseAnswer(`Here it is.\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\``)
    expect(answer.prose).toBe('Here it is.')
    expect(answer.spec?.root).toBe('a')
  })

  it('falls back to prose when the block is not JSON or breaks the catalog', () => {
    expect(parseAnswer('```json\n{"root": \n```').spec).toBeNull()
    const savings = { root: 'a', elements: { a: { type: 'savings_meter', props: {} } } }
    expect(parseAnswer(`\`\`\`json\n${JSON.stringify(savings)}\n\`\`\``).spec).toBeNull()
    const badCode = { root: 'a', elements: { a: { type: 'stat', props: { code: 'EEM99', input: 'x' } } } }
    expect(parseAnswer(`\`\`\`json\n${JSON.stringify(badCode)}\n\`\`\``).spec).toBeNull()
    expect(parseAnswer('Plain **markdown** answer.').prose).toBe('Plain **markdown** answer.')
  })

  it('knows when a card block is still streaming', () => {
    expect(isComposingCards('Lead.\n```json\n{"root":')).toBe(true)
    expect(isComposingCards(`Lead.\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\``)).toBe(false)
  })
})
