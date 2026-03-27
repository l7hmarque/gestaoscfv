const PresencaPage = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Presença</h1>
        <p className="text-sm text-muted-foreground">Registrar frequência das turmas</p>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
        Selecione uma turma para registrar presença.
      </div>
    </div>
  );
};

export default PresencaPage;
