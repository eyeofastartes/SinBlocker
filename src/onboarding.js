document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("doneBtn").addEventListener("click", async () => {
    await markOnboardingComplete();
    window.close();
  });

  document
    .getElementById("addFirstSiteBtn")
    .addEventListener("click", async () => {
      await markOnboardingComplete();
      chrome.runtime.openOptionsPage();
    });
});

async function markOnboardingComplete() {
  await updateStoredSettings({ onboardingComplete: true });
}
