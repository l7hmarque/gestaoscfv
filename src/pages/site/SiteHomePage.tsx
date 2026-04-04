import scnsaLogo from "@/assets/scnsa-logo.png";
import caiaLogo from "@/assets/caia-logo.png";
import { Users, Heart, BookOpen, Target, Calendar, Award } from "lucide-react";

const diretoria = [
  { nome: "A definir", cargo: "Presidente" },
  { nome: "A definir", cargo: "Vice-Presidente" },
  { nome: "A definir", cargo: "Secretário(a)" },
  { nome: "A definir", cargo: "Tesoureiro(a)" },
];

const comissao = [
  { nome: "A definir", cargo: "Conselheiro Fiscal 1" },
  { nome: "A definir", cargo: "Conselheiro Fiscal 2" },
  { nome: "A definir", cargo: "Conselheiro Fiscal 3" },
];

export default function SiteHomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#E5541B]/5 via-white to-[#3B8FC2]/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <div className="flex items-center justify-center gap-6 mb-8">
              <img src={scnsaLogo} alt="SCNSA" className="h-20 md:h-28 w-auto" />
              <div className="h-16 w-px bg-gray-300" />
              <img src={caiaLogo} alt="CAIA" className="h-16 md:h-24 w-auto" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Sociedade Civil<br />Nossa Senhora Aparecida
            </h1>
            <p className="text-lg md:text-xl text-[#E5541B] font-medium italic max-w-2xl mx-auto">
              "Olhando o passado, vivendo o presente e projetando o futuro."
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E5541B]/30 to-transparent" />
      </section>

      {/* Valores */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Heart, title: "Missão", text: "Promover o desenvolvimento integral de crianças, adolescentes e idosos em situação de vulnerabilidade social." },
              { icon: Target, title: "Visão", text: "Ser referência em assistência social no município de Medianeira e região." },
              { icon: Award, title: "Valores", text: "Ética, transparência, compromisso social, respeito à diversidade e valorização humana." },
            ].map((v) => (
              <div key={v.title} className="text-center p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 rounded-full bg-[#E5541B]/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="h-7 w-7 text-[#E5541B]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Histórico */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">
            Nossa <span className="text-[#E5541B]">História</span>
          </h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-4">
            <p>
              A Sociedade Civil Nossa Senhora Aparecida é uma Organização da Sociedade Civil (OSC) 
              sem fins lucrativos, fundada no município de Medianeira — Paraná. Ao longo de sua trajetória, 
              a instituição tem se dedicado à promoção do desenvolvimento social, atuando diretamente 
              com crianças, adolescentes e idosos em situação de vulnerabilidade.
            </p>
            <p>
              Por meio de convênios com o poder público municipal e parcerias com a sociedade civil, 
              a SCNSA executa programas de Serviço de Convivência e Fortalecimento de Vínculos (SCFV), 
              oferecendo atividades socioeducativas, culturais, esportivas e de convivência comunitária.
            </p>
            <p>
              Com uma gestão pautada na transparência e no compromisso com resultados, a instituição 
              busca continuamente aprimorar seus processos e ampliar o alcance de suas ações, 
              contribuindo para a construção de uma sociedade mais justa e inclusiva.
            </p>
          </div>
        </div>
      </section>

      {/* Diretoria */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center">
            Diretoria e <span className="text-[#3B8FC2]">Comissão Fiscal</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-[#E5541B] mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" /> Diretoria Executiva
              </h3>
              <div className="space-y-3">
                {diretoria.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-[#E5541B]/10 flex items-center justify-center text-[#E5541B] font-bold text-sm">
                      {m.cargo[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{m.nome}</p>
                      <p className="text-xs text-gray-500">{m.cargo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#3B8FC2] mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5" /> Conselho Fiscal
              </h3>
              <div className="space-y-3">
                {comissao.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-[#3B8FC2]/10 flex items-center justify-center text-[#3B8FC2] font-bold text-sm">
                      {m.cargo[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{m.nome}</p>
                      <p className="text-xs text-gray-500">{m.cargo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projeto CAIA */}
      <section className="py-16 bg-gradient-to-br from-[#3B8FC2]/5 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-10 text-center">
            Projetos em <span className="text-[#E5541B]">Andamento</span>
          </h2>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/3 bg-[#3B8FC2]/5 flex items-center justify-center p-8">
                <img src={caiaLogo} alt="CAIA Medianeira" className="h-32 w-auto" />
              </div>
              <div className="md:w-2/3 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">CAIA — Centro de Atividades para Idosos e Adolescentes</h3>
                <p className="text-sm text-[#3B8FC2] font-medium mb-4 flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Medianeira — PR
                </p>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  O CAIA é o principal projeto executado pela SCNSA, oferecendo Serviço de Convivência e 
                  Fortalecimento de Vínculos (SCFV) para crianças de 6 a 17 anos e idosos. O programa 
                  desenvolve atividades socioeducativas, esportivas, culturais e de convivência, 
                  promovendo o desenvolvimento integral dos participantes.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["SCFV", "Socioeducativo", "Esporte", "Cultura", "Convivência"].map((t) => (
                    <span key={t} className="px-3 py-1 bg-[#3B8FC2]/10 text-[#3B8FC2] text-xs font-medium rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
