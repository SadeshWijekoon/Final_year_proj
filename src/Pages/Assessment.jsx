import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const Assessment = ({ user, onClose, onViewHistory }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [assessmentResult, setAssessmentResult] = useState(null);

  const questions = [
    "Over the last 2 weeks, how often have you felt little interest or pleasure in doing things?",
    "Over the last 2 weeks, how often have you felt down, depressed, or hopeless?",
    "Over the last 2 weeks, how often have you had trouble falling or staying asleep, or sleeping too much?",
    "Over the last 2 weeks, how often have you felt tired or had little energy?",
    "Over the last 2 weeks, how often have you had poor appetite or overeaten?",
    "Over the last 2 weeks, how often have you felt bad about yourself - or that you're a failure or have let yourself or your family down?",
    "Over the last 2 weeks, how often have you had trouble concentrating on things, such as reading the newspaper or watching television?",
    "Over the last 2 weeks, how often have you been moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual?",
    "Over the last 2 weeks, how often have you had thoughts that you would be better off dead or of hurting yourself in some way?"
  ];

  const answerOptions = [
    "Not at all",
    "Several days",
    "More than half the days",
    "Nearly every day"
  ];

  const saveAssessmentResult = async (result) => {
    try {
      await addDoc(collection(db, 'assessments'), {
        userId: user.uid,
        score: result.score,
        severity: result.severity,
        recommendation: result.recommendation,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving assessment result:", error);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      const result = calculateResult(newAnswers);
      setAssessmentResult(result);
      saveAssessmentResult(result);
    }
  };

  const calculateResult = (userAnswers) => {
    const totalScore = userAnswers.reduce((sum, answer) => sum + (answer || 0), 0);
    
    let result = {
      score: totalScore,
      severity: '',
      recommendation: ''
    };

    if (totalScore <= 4) {
      result.severity = 'Minimal or no depression';
      result.recommendation = 'Your mental health appears to be in good condition. Maintain healthy habits like regular exercise, good sleep, and social connections.';
    } else if (totalScore <= 9) {
      result.severity = 'Mild depression';
      result.recommendation = 'You may be experiencing mild symptoms. Consider self-care strategies, mindfulness exercises, or speaking with a counselor if symptoms persist.';
    } else if (totalScore <= 14) {
      result.severity = 'Moderate depression';
      result.recommendation = 'Your symptoms suggest moderate depression. We recommend consulting with a mental health professional for evaluation and possible treatment.';
    } else if (totalScore <= 19) {
      result.severity = 'Moderately severe depression';
      result.recommendation = 'Your responses indicate moderately severe symptoms. Please consider seeking help from a mental health professional as soon as possible.';
    } else {
      result.severity = 'Severe depression';
      result.recommendation = 'Your responses suggest severe depression. We strongly recommend contacting a mental health professional immediately or reaching out to a crisis hotline if needed.';
    }

    return result;
  };

  const restartAssessment = () => {
    setAnswers([]);
    setCurrentQuestion(0);
    setAssessmentResult(null);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
      {!assessmentResult ? (
        <>
          <h2 className="text-2xl font-bold mb-6 text-center">
            Mental Health Assessment
          </h2>
          <div className="mb-4">
            <p className="text-lg font-semibold mb-2">
              Question {currentQuestion + 1} of {questions.length}
            </p>
            <p className="text-lg mb-4">{questions[currentQuestion]}</p>
            <div className="space-y-2">
              {answerOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className="w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-100 text-left"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            {currentQuestion > 0 && (
              <button
                onClick={() => setCurrentQuestion(currentQuestion - 1)}
                className="bg-gray-300 text-gray-800 p-2 rounded-lg hover:bg-gray-400"
              >
                Previous
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"
            >
              Cancel Assessment
            </button>
          </div>
        </>
      ) : (
        <div>
          <h2 className="text-2xl font-bold mb-6 text-center">
            Your Mental Health Assessment Results
          </h2>
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <p className="text-lg font-semibold mb-2">Score: {assessmentResult.score}</p>
            <p className="text-lg font-semibold mb-2">Severity: {assessmentResult.severity}</p>
            <p className="text-lg mb-4">{assessmentResult.recommendation}</p>
            {assessmentResult.score >= 10 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <p className="font-semibold">Important:</p>
                <p>If you're experiencing distress or having thoughts of self-harm, please reach out to a mental health professional or contact a crisis hotline immediately.</p>
              </div>
            )}
          </div>
          <div className="flex justify-center space-x-4">
            <button
              onClick={restartAssessment}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 px-4"
            >
              Retake Assessment
            </button>
            <button
              onClick={onClose}
              className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-700 px-4"
            >
              Return to Home
            </button>
            <button
              onClick={onViewHistory}
              className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 px-4"
            >
              View History
            </button>
            {assessmentResult.score >= 5 && (
              <button
                onClick={() => window.location.href = '/chat'}
                className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 px-4"
              >
                Talk with AI Assistant
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessment;