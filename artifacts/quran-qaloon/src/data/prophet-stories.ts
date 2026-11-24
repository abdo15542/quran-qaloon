// قصص الأنبياء — coverage only (1.0.114, build-114-data/compute-114.mts).
// Each prophet links to an EXISTING topic in src/data/topics.ts; the story
// itself is that topic's ayah list, shown in Quran order from QURAN_TEXT.
// No grouping was invented: prophets with no usable topic in the data are
// absent here (see the build log). The page resolves ayahs via TOPICS.
export interface ProphetStory {
  /** Prophet name, exactly as the topic is named in the topics data. */
  name: string;
  /** Topic id in TOPICS whose ayah list is the story. */
  topicId: number;
  /** Ayah count in that topic (computed at build time). */
  ayahCount: number;
}

export const PROPHET_STORIES: ProphetStory[] = [{"name":"موسى","topicId":100020,"ayahCount":419},{"name":"إبراهيم","topicId":100044,"ayahCount":146},{"name":"يوسف","topicId":2788,"ayahCount":102},{"name":"نوح","topicId":100086,"ayahCount":96},{"name":"لوط","topicId":3047,"ayahCount":55},{"name":"عيسى","topicId":100036,"ayahCount":47},{"name":"سليمان","topicId":4427,"ayahCount":44},{"name":"محمد","topicId":100097,"ayahCount":41},{"name":"آدم","topicId":100013,"ayahCount":39},{"name":"هود","topicId":100130,"ayahCount":39},{"name":"شعيب","topicId":3061,"ayahCount":37},{"name":"صالح","topicId":100132,"ayahCount":36},{"name":"هارون","topicId":100070,"ayahCount":29},{"name":"يعقوب","topicId":768,"ayahCount":27},{"name":"زكريا","topicId":100088,"ayahCount":23},{"name":"إسماعيل","topicId":703,"ayahCount":21},{"name":"يحيى","topicId":1697,"ayahCount":21},{"name":"داود","topicId":100072,"ayahCount":19},{"name":"يونس","topicId":100099,"ayahCount":19},{"name":"إسحاق","topicId":4297,"ayahCount":17},{"name":"إلياس","topicId":2792,"ayahCount":9},{"name":"أيوب","topicId":4438,"ayahCount":8},{"name":"إدريس","topicId":4301,"ayahCount":3},{"name":"اليسع","topicId":100117,"ayahCount":2},{"name":"ذو الكفل","topicId":100208,"ayahCount":1}];
export const PROPHET_STORIES_TOTAL = 25;
