const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/chat/ask
exports.askAI = async (req, res) => {
  try {
    const { prompt, role } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemPrompt = role === 'admin'
      ? "You are Nexi AI, an intelligent and helpful administration assistant. You help the department head and administrators manage department schedules, teacher assignments, student affairs, academic standards, and department policies. You are conversational and polite."
      : (role === 'teacher'
        ? "You are Nexi AI, an intelligent and helpful teaching assistant. You help teachers design lesson plans, create quiz questions, write parent emails, structure syllabus/subjects, and manage class tasks. You are conversational and polite."
        : "You are Nexi AI, an intelligent and helpful study assistant for students. You explain concepts clearly, provide study tips, and help with assignments. You are conversational and polite.");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the fast & cost-effective mini model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 600,
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: 'Failed to communicate with AI' });
  }
};
