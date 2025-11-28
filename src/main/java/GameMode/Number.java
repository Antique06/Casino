package main.java.GameMode;

public enum Number {
    NULL(null, null),
    ZERO(Couleur.VERT,"0"),
    DOUBLE_ZERO(Couleur.VERT, "00"),
    UN(Couleur.ROUGE, "1"),
    DEUX(Couleur.NOIR, "2"),
    TROIS(Couleur.ROUGE, "3"),
    QUATRE(Couleur.NOIR, "4"),
    CINQ(Couleur.ROUGE, "5"),
    SIX(Couleur.NOIR, "6"),
    SEPT(Couleur.ROUGE, "7"),
    HUIT(Couleur.NOIR, "8"),
    NEUF(Couleur.ROUGE, "9"),
    DIX(Couleur.NOIR, "10"),
    ONZE(Couleur.NOIR, "11"),
    DOUZE(Couleur.ROUGE, "12"),
    TREIZE(Couleur.NOIR, "13"),
    QUATORZE(Couleur.ROUGE, "14"),
    QUINZE(Couleur.NOIR, "15"),
    SEIZE(Couleur.ROUGE, "16"),
    DIX_SEPT(Couleur.NOIR, "17"),
    DIX_HUIT(Couleur.ROUGE, "18"),
    DIX_NEUF(Couleur.ROUGE, "19"),
    VINGT(Couleur.NOIR, "20"),
    VINGT_ET_UN(Couleur.ROUGE, "21"),
    VINGT_DEUX(Couleur.NOIR, "22"),
    VINGT_TROIS(Couleur.ROUGE, "23"),
    VINGT_QUATRE(Couleur.NOIR, "24"),
    VINGT_CINQ(Couleur.ROUGE, "25"),
    VINGT_SIX(Couleur.NOIR, "26"),
    VINGT_SEPT(Couleur.ROUGE, "27"),
    VINGT_HUIT(Couleur.NOIR, "28"),
    VINGT_NEUF(Couleur.NOIR, "29"),
    TRENTE(Couleur.ROUGE, "30"),
    TRENTE_ET_UN(Couleur.NOIR, "31"),
    TRENTE_DEUX(Couleur.ROUGE, "32"),
    TRENTE_TROIS(Couleur.NOIR, "33"),
    TRENTE_QUATRE(Couleur.ROUGE, "34"),
    TRENTE_CINQ(Couleur.NOIR, "35"),
    TRENTE_SIX(Couleur.ROUGE, "36");

    private final Couleur couleur;
    private final String value;

    Number(Couleur couleur, String value) {
        this.couleur = couleur;
        this.value = value;
    }

    public Couleur getCouleur() {
        return couleur;
    }

    public String getValue() {
        return value;
    }
}
