import fs from 'node:fs'
import path from 'node:path'
import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { Fragment } from 'react'
import sharp from 'sharp'
import { imagePath } from '@/lib/images'
import type { RecipePdfModel } from './model'

const fontsDir = path.join(process.cwd(), 'src/lib/pdf/fonts')

Font.register({
  family: 'Fraunces',
  fonts: [
    { src: path.join(fontsDir, 'Fraunces72ptSoft-Regular.ttf') },
    { src: path.join(fontsDir, 'Fraunces72ptSoft-SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Fraunces72ptSoft-Italic.ttf'), fontStyle: 'italic' },
  ],
})
Font.register({
  family: 'Figtree',
  fonts: [
    { src: path.join(fontsDir, 'Figtree-Regular.ttf') },
    { src: path.join(fontsDir, 'Figtree-SemiBold.ttf'), fontWeight: 600 },
  ],
})
Font.registerHyphenationCallback((word) => [word])

const paper = '#FBF8F2'
const ink = '#2B2520'
const olive = '#4A5D3A'
const butter = '#F2D27A'
const hairline = '#E4DDD1'
const muted = '#6B6259'
const secondary = '#E6EADF'

const A4 = { width: 595.28, height: 841.89 }
const MARGIN_X = 52
const CONTENT_WIDTH = A4.width - 2 * MARGIN_X

const s = StyleSheet.create({
  page: {
    backgroundColor: paper,
    color: ink,
    fontFamily: 'Figtree',
    fontSize: 10.5,
    lineHeight: 1.5,
    paddingTop: 48,
    paddingBottom: 72,
    paddingHorizontal: MARGIN_X,
  },
  cover: { width: '100%', objectFit: 'cover', borderRadius: 6, marginBottom: 24 },
  title: { fontFamily: 'Fraunces', fontSize: 30, lineHeight: 1.1, letterSpacing: -0.5 },
  description: { marginTop: 10, fontSize: 11.5, color: muted },
  meta: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    fontSize: 9,
    color: muted,
  },
  byline: { marginRight: 6 },
  tag: {
    marginRight: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: secondary,
    color: ink,
  },
  summary: {
    marginTop: 22,
    paddingVertical: 14,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: hairline,
  },
  servings: { fontWeight: 600, fontSize: 11 },
  batch: { fontSize: 9, color: muted },
  basis: {
    marginTop: 12,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: muted,
  },
  figures: { marginTop: 6, flexDirection: 'row' },
  figure: { flex: 1 },
  figureValue: { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 20, lineHeight: 1.1 },
  figureUnit: { fontFamily: 'Figtree', fontWeight: 400, fontSize: 9, color: muted },
  kcal: { alignSelf: 'flex-start' },
  butter: { height: 4, marginTop: 1, backgroundColor: butter },
  figureLabel: { marginTop: 3, fontSize: 8.5, color: muted },
  footerTitle: { flex: 1, marginRight: 12 },
  heading: {
    marginTop: 26,
    marginBottom: 4,
    fontFamily: 'Fraunces',
    fontSize: 18,
    lineHeight: 1.2,
  },
  group: { fontFamily: 'Fraunces', fontStyle: 'italic', fontSize: 12.5, marginTop: 10 },
  line: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderColor: hairline,
  },
  amount: { width: 80, fontWeight: 600 },
  name: { flex: 1 },
  brand: { fontSize: 8.5, color: muted },
  grams: { width: 64, textAlign: 'right', fontSize: 9, color: muted },
  step: { flexDirection: 'row', marginTop: 12 },
  number: {
    width: 30,
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 18,
    lineHeight: 1.1,
    color: olive,
  },
  stepBody: { flex: 1 },
  stepImage: { marginTop: 8, borderRadius: 4 },
  footer: {
    position: 'absolute',
    // a fixed footer anchored with `bottom` only renders on the last page
    top: A4.height - 50,
    left: MARGIN_X,
    right: MARGIN_X,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderColor: hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: muted,
  },
})

type Images = Map<string, Buffer | null>

function fit({ width, height }: { width: number; height: number }, maxW: number, maxH: number) {
  const scale = Math.min(maxW / width, maxH / height)
  return { width: width * scale, height: height * scale }
}

function RecipeDocument({ model, images }: { model: RecipePdfModel; images: Images }) {
  const cover = model.cover && images.get(model.cover.id)
  return (
    <Document title={model.title} author={model.byline} language={model.locale}>
      <Page size="A4" style={s.page}>
        <View style={s.footer} fixed>
          <Text style={s.footerTitle}>{model.title}</Text>
          <Text render={({ pageNumber, totalPages }) => model.page(pageNumber, totalPages)} />
        </View>
        {model.cover && cover && (
          <PdfImage
            src={{ data: cover, format: 'jpg' }}
            style={[
              s.cover,
              { height: Math.min((CONTENT_WIDTH * model.cover.height) / model.cover.width, 300) },
            ]}
          />
        )}
        <Text style={s.title}>{model.title}</Text>
        {model.description && <Text style={s.description}>{model.description}</Text>}
        <View style={s.meta}>
          <Text style={s.byline}>{model.byline}</Text>
          {model.tags.map((tag) => (
            <Text key={tag} style={s.tag}>
              {tag}
            </Text>
          ))}
        </View>

        <View style={s.summary} wrap={false}>
          <Text style={s.servings}>{model.servings}</Text>
          <Text style={s.batch}>{model.batchKcal}</Text>
          <Text style={s.basis}>{model.perServingLabel}</Text>
          <View style={s.figures}>
            {model.figures.map((figure) => (
              <View key={figure.key} style={s.figure}>
                {figure.unit ? (
                  <Text style={s.figureValue}>
                    {figure.value}
                    <Text style={s.figureUnit}> {figure.unit}</Text>
                  </Text>
                ) : (
                  <View style={s.kcal}>
                    <Text style={s.figureValue}>{figure.value}</Text>
                    <View style={s.butter} />
                  </View>
                )}
                <Text style={s.figureLabel}>{figure.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {model.groups.length > 0 && (
          <Text style={s.heading} minPresenceAhead={60}>
            {model.ingredientsLabel}
          </Text>
        )}
        {model.groups.map((group) => (
          <Fragment key={group.name ?? ''}>
            {group.name && (
              <Text style={s.group} minPresenceAhead={40}>
                {group.name}
              </Text>
            )}
            {group.lines.map((line) => (
              <View key={line.id} style={s.line} wrap={false}>
                <Text style={s.amount}>{line.amount}</Text>
                <View style={s.name}>
                  <Text>{line.name}</Text>
                  {line.brand && <Text style={s.brand}>{line.brand}</Text>}
                </View>
                <Text style={s.grams}>{line.grams}</Text>
              </View>
            ))}
          </Fragment>
        ))}

        {model.steps.length > 0 && (
          <Text style={s.heading} minPresenceAhead={60}>
            {model.stepsLabel}
          </Text>
        )}
        {model.steps.map((step) => {
          const image = step.image && images.get(step.image.id)
          return (
            <View key={step.id} style={s.step} wrap={!image}>
              <Text style={s.number}>{step.number}</Text>
              <View style={s.stepBody}>
                <Text orphans={3} widows={3}>
                  {step.text}
                </Text>
                {step.image && image && (
                  <PdfImage
                    src={{ data: image, format: 'jpg' }}
                    style={[s.stepImage, fit(step.image, 280, 220)]}
                  />
                )}
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}

async function loadJpeg(id: string) {
  const file = imagePath(id)
  if (!fs.existsSync(file)) return null
  return sharp(file)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
}

export async function renderRecipePdf(model: RecipePdfModel) {
  const ids = [model.cover, ...model.steps.map((step) => step.image)]
    .filter((img) => img !== null)
    .map((img) => img.id)
  const images: Images = new Map(
    await Promise.all(ids.map(async (id) => [id, await loadJpeg(id)] as const))
  )
  return renderToBuffer(<RecipeDocument model={model} images={images} />)
}
