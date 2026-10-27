/**
 * Asks the browser not to evict the local database under storage pressure. Called after the first
 * save rather than on load, because Firefox shows a prompt and Chrome decides by engagement.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) {
      return
    }
    await navigator.storage.persist()
  } catch (error) {
    console.error('Could not request persistent storage', error)
  }
}
