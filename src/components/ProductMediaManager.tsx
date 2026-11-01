import { ChangeEvent, useEffect, useRef, useState } from 'react'

export interface MediaDraft {
  key: string
  type: 'image' | 'video'
  url: string
  file?: File
}

const aspectRatios: Record<string, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 }

export default function ProductMediaManager({ items, onAdd, onRemove, onReplace, disabled }: {
  items: MediaDraft[]
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  onReplace: (key: string, file: File) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState<MediaDraft | null>(null)
  const [error, setError] = useState('')
  function add(event: ChangeEvent<HTMLInputElement>) {
    onAdd(Array.from(event.target.files ?? []))
    event.target.value = ''
  }
  return <section className="product-media-manager span-two" aria-label="Ảnh và video sản phẩm">
    <div className="product-media-heading"><div><b>Ảnh và video</b><small>Ảnh/video chỉ được tải lên sau khi bấm lưu sản phẩm.</small></div><label className="button button-light product-media-add">＋ Thêm ảnh/video<input type="file" accept="image/*,video/*" multiple onChange={add} disabled={disabled} /></label></div>
    {items.length ? <div className="product-media-grid">{items.map((item, index) => <article className="product-media-card" key={item.key}>
      {item.type === 'image' ? <img src={item.url} alt={`Ảnh sản phẩm ${index + 1}`} /> : <video src={item.url} controls preload="metadata" aria-label={`Video sản phẩm ${index + 1}`} />}
      <div className="product-media-card-footer"><span>{item.type === 'image' ? `Ảnh ${index + 1}` : 'Video'}</span><div><button type="button" className="button button-light" onClick={() => { setError(''); setEditing(item) }} disabled={disabled}>Sửa</button><button type="button" className="button button-light media-remove" onClick={() => onRemove(item.key)} disabled={disabled}>Xóa</button></div></div>
    </article>)}</div> : <p className="product-media-empty">Chưa có ảnh hoặc video. Hãy thêm file bạn muốn dùng cho sản phẩm.</p>}
    {error && <p className="admin-form-message" role="alert">{error}</p>}
    {editing && <MediaEditModal item={editing} onCancel={() => setEditing(null)} onSave={file => { try { onReplace(editing.key, file); setEditing(null); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu chỉnh sửa media.') } }} />}
  </section>
}

function MediaEditModal({ item, onCancel, onSave }: { item: MediaDraft; onCancel: () => void; onSave: (file: File) => void }) {
  if (item.type === 'image') return <ImageCropModal item={item} onCancel={onCancel} onSave={onSave} />
  return <div className="admin-modal-backdrop media-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><section className="admin-modal media-edit-modal" role="dialog" aria-modal="true" aria-labelledby="media-edit-title">
    <div className="admin-modal-heading"><div><p className="admin-kicker">MEDIA EDITOR</p><h2 id="media-edit-title">Cắt thời lượng video</h2></div><button className="admin-modal-close" type="button" onClick={onCancel}>×</button></div>
    <VideoTrimEditor item={item} onSave={onSave} />
  </section></div>
}

export function ImageCropModal({ item, onCancel, onSave }: { item: MediaDraft; onCancel: () => void; onSave: (file: File) => void }) {
  return <div className="admin-modal-backdrop media-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><section className="admin-modal media-edit-modal" role="dialog" aria-modal="true" aria-labelledby="image-crop-title">
    <div className="admin-modal-heading"><div><p className="admin-kicker">IMAGE EDITOR</p><h2 id="image-crop-title">Cắt ảnh</h2></div><button className="admin-modal-close" type="button" onClick={onCancel}>×</button></div>
    <ImageCropEditor item={item} onSave={onSave} />
  </section></div>
}

function ImageCropEditor({ item, onSave }: { item: MediaDraft; onSave: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [aspect, setAspect] = useState('1:1')
  const [zoom, setZoom] = useState(1)
  const [horizontal, setHorizontal] = useState(50)
  const [vertical, setVertical] = useState(50)
  const [error, setError] = useState('')
  useEffect(() => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => { imageRef.current = image; draw() }
    image.onerror = () => setError('Không tải được ảnh để chỉnh sửa.')
    image.src = item.url
  }, [item.url])
  function draw() {
    const image = imageRef.current
    const canvas = canvasRef.current
    if (!image || !canvas) return
    const ratio = aspectRatios[aspect]
    canvas.width = 800
    canvas.height = Math.round(800 / ratio)
    let cropWidth = image.naturalWidth
    let cropHeight = cropWidth / ratio
    if (cropHeight > image.naturalHeight) { cropHeight = image.naturalHeight; cropWidth = cropHeight * ratio }
    cropWidth /= zoom
    cropHeight /= zoom
    const x = (image.naturalWidth - cropWidth) * horizontal / 100
    const y = (image.naturalHeight - cropHeight) * vertical / 100
    const context = canvas.getContext('2d')
    context?.drawImage(image, x, y, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
  }
  useEffect(draw, [aspect, zoom, horizontal, vertical])
  async function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Trình duyệt không xuất được ảnh đã cắt.')), 'image/png'))
      onSave(new File([blob], (item.file?.name ?? 'product-image').replace(/\.[^.]+$/, '') + '-crop.png', { type: 'image/png' }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu ảnh đã cắt.') }
  }
  return <div className="media-edit-body"><canvas className="image-crop-preview" ref={canvasRef} aria-label="Xem trước phần ảnh đã cắt" />
    <div className="media-edit-controls"><label>Tỉ lệ khung<select value={aspect} onChange={event => setAspect(event.target.value)}>{Object.keys(aspectRatios).map(value => <option key={value}>{value}</option>)}</select></label><label>Thu phóng<input type="range" min="1" max="4" step=".05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label><label>Vị trí ngang<input type="range" min="0" max="100" value={horizontal} onChange={event => setHorizontal(Number(event.target.value))} /></label><label>Vị trí dọc<input type="range" min="0" max="100" value={vertical} onChange={event => setVertical(Number(event.target.value))} /></label></div>
    {error && <p className="admin-form-message" role="alert">{error}</p>}<div className="media-edit-actions"><button type="button" className="button button-dark" onClick={() => void save()}>Lưu ảnh đã cắt</button></div>
  </div>
}

function VideoTrimEditor({ item, onSave }: { item: MediaDraft; onSave: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function renderClip() {
    const video = videoRef.current
    if (!video || end <= start) { setError('Thời điểm kết thúc phải lớn hơn thời điểm bắt đầu.'); return }
    const mediaVideo = video as HTMLVideoElement & { captureStream?: () => MediaStream; webkitCaptureStream?: () => MediaStream }
    const capture = mediaVideo.captureStream ?? mediaVideo.webkitCaptureStream
    if (!capture || typeof MediaRecorder === 'undefined') { setError('Trình duyệt này không hỗ trợ xuất clip đã cắt.'); return }
    setBusy(true); setError('')
    let stream: MediaStream | undefined
    try {
      video.pause()
      if (Math.abs(video.currentTime - start) > .03) {
        await new Promise<void>((resolve, reject) => { video.addEventListener('seeked', () => resolve(), { once: true }); video.addEventListener('error', () => reject(new Error('Không tua được video.')), { once: true }); video.currentTime = start })
      }
      const capturedStream = capture.call(video)
      stream = capturedStream
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(capturedStream, mimeType ? { mimeType } : undefined)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      const stopped = new Promise<void>((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error('Không ghi được clip video.')) })
      recorder.start()
      await video.play()
      await new Promise<void>((resolve, reject) => {
        let timer = 0
        const finish = () => { window.clearInterval(timer); resolve() }
        const check = () => { if (video.currentTime >= end) { video.pause(); finish() } }
        timer = window.setInterval(check, 80)
        video.addEventListener('ended', finish, { once: true })
        check()
      })
      recorder.stop()
      await stopped
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' })
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
      onSave(new File([blob], (item.file?.name ?? 'product-video').replace(/\.[^.]+$/, '') + '-trim.' + extension, { type: blob.type }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể cắt video.') }
    finally { stream?.getTracks().forEach(track => track.stop()); setBusy(false) }
  }
  return <div className="media-edit-body"><video ref={videoRef} src={item.url} controls preload="metadata" onLoadedMetadata={event => { const value = event.currentTarget.duration; setDuration(value); setEnd(value) }} onTimeUpdate={event => { if (!busy && duration && event.currentTarget.currentTime >= end) { event.currentTarget.pause(); event.currentTarget.currentTime = start } }} />
    <div className="media-edit-controls"><label>Bắt đầu (giây)<input type="number" min="0" max={Math.max(0, end - .1)} step=".1" value={start} onChange={event => setStart(Math.min(Number(event.target.value), Math.max(0, end - .1)))} /></label><label>Kết thúc (giây)<input type="number" min={Math.min(duration, start + .1)} max={duration} step=".1" value={end} onChange={event => setEnd(Math.max(Number(event.target.value), start + .1))} /></label><p>Clip dài {Math.max(0, end - start).toFixed(1)} giây. Video sẽ được ghi thành file mới; âm thanh được giữ nếu trình duyệt cấp luồng âm thanh.</p></div>
    {error && <p className="admin-form-message" role="alert">{error}</p>}<div className="media-edit-actions"><button type="button" className="button button-dark" disabled={busy || !duration} onClick={() => void renderClip()}>{busy ? 'Đang cắt video…' : 'Lưu đoạn video đã cắt'}</button></div>
  </div>
}
