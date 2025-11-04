import React from 'react';
import jsPDF from 'jspdf';
import { Game } from '../models';

interface Props {
  game: Game;
}

const ReportsScreen: React.FC<Props> = ({ game }) => {
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`Game Report: vs ${game.opponent}`, 10, 10);
    doc.text(`Score: ${game.homeScore} - ${game.oppScore}`, 10, 20);
    doc.text('Play-by-Play:', 10, 30);
    game.plays.forEach((play, i) => {
      doc.text(play.description, 10, 40 + i * 10);
    });
    // Expand: Add stats tables with jsPDF-autotable
    doc.save('game_report.pdf');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl">Reports</h1>
      <button onClick={generatePDF} className="btn btn-primary">Generate PDF</button>
      {/* Add preview or custom templates */}
    </div>
  );
};

export default ReportsScreen;

export {};