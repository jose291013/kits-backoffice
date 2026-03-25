function groupRowsByKit(rows) {
  const map = new Map();

  for (const row of rows) {
    const partId = row["Part ID"];
    if (!partId) continue;

    if (!map.has(partId)) {
      map.set(partId, {
        partId,
        defaultKitQty: 1,
        components: []
      });
    }

    map.get(partId).components.push({
      componentId: row["Component ID"],
      productName: row["Component ID"],
      langCode: row["Lang / Taal"],
      defaultComponentQty: row["Quantity"],
      q2StandardQuotation: row["STD quotation MP"] || row["Numéro unique price motor = Q2"],
      q3Height: row["Height_NEW"],
      q4Width: row["Width_NEW"],
      pressersoIdNumber: row["Pressero ID number"]
    });
  }

  return Array.from(map.values());
}

module.exports = {
  groupRowsByKit
};