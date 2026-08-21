/**
 * Client half of dock-media: registers the 'media' file viewer against the
 * dock-files file domain (audio + video extensions) and the matching
 * editor-area view against dock. The view renders a file's media content,
 * streamed (Range-aware) through its own /dock-media/source host route, as
 * either a fullscreen-capable video player or a music player for pure audio.
 *
 * inject declares BOTH 'workbench' and 'files': Cordis activates this plugin
 * only after dock (carrier) and dock-files (file domain) have provided their
 * services, so the viewer registration is never skipped by activation order.
 */
import type {} from './contract.ts'
import type { WorkbenchContext, WorkbenchService } from './contract.ts'
import { MediaView } from './MediaView'
import { mountStyles } from './styles'

/** Requires the workbench base (carrier) and the dock-files file domain. */
export const inject = ['workbench', 'files']

/** Local structural face of ctx.files (avoid type dependency on dock-files). */
interface FilesService {
  registerFileViewer(def: {
    id: string
    exts?: string[]
    default?: boolean
    icon?: { color?: string; path?: string; viewBox?: string }
  }): () => void
}

/** The extensions this viewer claims (audio + video containers/codecs). */
const MEDIA_EXTS = [
  // audio
  'mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aac', 'm4a', 'weba', 'wma', 'mid', 'midi',
  // video
  'mp4', 'm4v', 'webm', 'mov', 'mkv', 'ogv', 'avi', 'mpg', 'mpeg', 'flv', 'wmv', 'ts', '3gp',
]

/** Client plugin body. */
export function apply(ctx: WorkbenchContext): void {
  const workbench = ctx.get<WorkbenchService>('workbench')
  const files = ctx.get<FilesService>('files')
  // inject guarantees both services are present when this applies; guard
  // anyway so a broken runtime degrades instead of throwing.
  if (workbench === undefined || files === undefined) return

  // Player stylesheet (disc / equalizer / range / fullscreen backdrop).
  ctx.effect(() => mountStyles(), 'dock-media: styles')

  // Register the media viewer for audio + video extensions, with the
  // explorer icon for those types: a rounded frame with a play triangle
  // (single evenodd path in a 16×16 viewBox) tinted a warm media orange.
  ctx.effect(() => files.registerFileViewer({
    id: 'media',
    exts: MEDIA_EXTS,
    icon: {
      color: '#e0894d',
      viewBox: '0 0 16 16',
      path: 'M5.20 2.40h5.60a2.8 2.8 0 0 1 2.8 2.8v5.60a2.8 2.8 0 0 1 -2.8 2.8h-5.60a2.8 2.8 0 0 1 -2.8 -2.8v-5.60a2.8 2.8 0 0 1 2.8 -2.8zM5.80 4.00h4.40a1.8 1.8 0 0 1 1.8 1.8v4.40a1.8 1.8 0 0 1 -1.8 1.8h-4.40a1.8 1.8 0 0 1 -1.8 -1.8v-4.40a1.8 1.8 0 0 1 1.8 -1.8zM6.6 5.4L10.4 8L6.6 10.6z',
    },
  }), 'dock-media: file viewer')

  // The view that receives open seeds ({ path, title }). It stays registered
  // as an editor-area view because floating windows resolve their view
  // through this registry; opening itself is always floating (dock-files
  // dispatches { mode: 'floating' }).
  ctx.effect(() => workbench.registerEditorView({
    id: 'media',
    title: 'Media',
    order: 130,
    component: MediaView,
  }), 'dock-media: view')
}
